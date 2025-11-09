import express from "express";
import cors from "cors";
import { Pool } from 'pg'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
// @ts-ignore
import Minio from 'minio'
import faqs from './faq.json' assert { type: 'json' }

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// -------- Mock templates for Admin UI
const templates = [
  { id: "tmpl-1", name: "BillTest", description: "test", status: "Active", steps: 0, products: 0, created: "11/14/2025" },
  { id: "tmpl-2", name: "Consumer-Unsecured Loan", description: "Demo application template for a US Consumer-Unsecured Loan.", status: "Active", steps: 0, products: 0, created: "10/09/2025" }
];

app.get("/api/templates", (req, res) => {
  const q = ((req.query.q as string) || "").toLowerCase();
  const status = (req.query.status as string) || "All Templates";
  let data = templates.filter(
    t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
  );
  if (status !== "All Templates") data = data.filter(t => t.status === status);
  res.json({ items: data });
});

// -------- In-memory tenant config (demo)
let branding:any = { logoUrl: "", colors:{ primary: "#155EEF" }, mode: "light" }
let featureFlags = [
  { key: "portal.esign", enabled: true, description: "Enable e-sign flow" },
  { key: "uw.scorecard", enabled: true, description: "Show scorecard tab in Underwriter UI" },
  { key: "ai.copilot", enabled: false, description: "Enable AI assistant" }
]
let workflow:any = {
  states: ["DRAFT","SUBMITTED","UNDER_REVIEW","DECIDED","ESIGNED"],
  transitions: [
    { from:"DRAFT", to:"SUBMITTED", guard:"allRequiredDocsUploaded" },
    { from:"SUBMITTED", to:"UNDER_REVIEW" },
    { from:"UNDER_REVIEW", to:"DECIDED" }
  ]
};

app.get("/api/config/branding", (_req,res)=> res.json(branding))
app.put("/api/config/branding", (req,res)=> { branding = req.body; res.json({ok:true}) })

app.get("/api/config/feature-flags", (_req,res)=> res.json(featureFlags))
app.put("/api/config/feature-flags", (req,res)=> { featureFlags = req.body; res.json({ok:true}) })

app.get("/api/config/workflow", (_req,res)=> res.json(workflow))
app.put("/api/config/workflow", (req,res)=> { workflow = req.body; res.json({ok:true}) })

// -------- OpenAPI stub
app.get("/v1/openapi.json", (_req,res)=> {
  res.json({
    openapi: "3.0.0",
    info: { title: "Originate Lite BFF", version: "0.1.0" },
    paths: {
      "/api/templates": { get: { summary: "List application templates" } },
      "/api/config/branding": { get: {summary:"Get branding"}, put:{summary:"Update branding"} },
      "/api/config/feature-flags": { get: {summary:"Get flags"}, put:{summary:"Update flags"} },
      "/api/config/workflow": { get: {summary:"Get workflow"}, put:{summary:"Update workflow"} },
      "/api/db/seed": { post: { summary: "Seed demo rows" } },
      "/api/db/apps": { get: { summary: "List apps from Postgres" } },
      "/api/files/presign": { get: { summary: "Create presigned PUT/GET URLs" } },
      "/api/queue/test": { post: { summary: "Send SQS message (LocalStack)" } },
      "/api/copilot/faq": { get: { summary: "FAQ search using local knowledge" } },
      "/v1/webhooks/test": { post: { summary: "Send signed webhook to a target URL" } }
    }
  })
})

// -------- Webhook sender (HMAC-SHA256)
async function signBody(secret:string, body:string){
  const crypto = await import('crypto');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return 'sha256='+sig;
}
app.post("/v1/webhooks/test", async (req,res)=>{
  const target = req.query.target as string;
  const secret = (req.query.secret as string) || "demo-secret";
  if(!target) return res.status(400).json({error:"target query param required"});
  const body = JSON.stringify({ event:"TestEvent", at: new Date().toISOString(), sample: { id: "evt_123" } });
  const sig = await signBody(secret, body);
  try {
    const fetchMod = await import('node-fetch').catch(()=>({default: null}));
    const fetchFn = (globalThis.fetch || fetchMod?.default);
    if(!fetchFn) throw new Error("No fetch available");
    const r = await fetchFn(target, { method:"POST", headers: { "Content-Type":"application/json","X-Signature":sig }, body });
    res.json({ ok: true, status: r.status, sent: JSON.parse(body), signature: sig });
  } catch(e:any) {
    res.status(500).json({ ok:false, error: e.message, signature: sig, sent: JSON.parse(body) });
  }
})

// ======= Infra: Postgres, MinIO, SQS =======
const {
  POSTGRES_HOST='postgres',
  POSTGRES_PORT='5432',
  POSTGRES_DB='originate',
  POSTGRES_USER='appuser',
  POSTGRES_PASSWORD='apppass',

  MINIO_ENDPOINT='minio',
  MINIO_PORT='9000',
  MINIO_USE_SSL='false',
  MINIO_ACCESS_KEY='minioadmin',
  MINIO_SECRET_KEY='minioadmin',
  MINIO_BUCKET='originate-docs',

  AWS_REGION='us-east-1',
  SQS_ENDPOINT='http://localstack:4566',
  SQS_QUEUE_URL='http://localstack:4566/000000000000/originate-events',
} = process.env

// Postgres
const pgPool = new Pool({
  host: POSTGRES_HOST,
  port: parseInt(POSTGRES_PORT,10),
  database: POSTGRES_DB,
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
})
async function pgInit(){
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      applicant TEXT,
      product TEXT,
      amount NUMERIC,
      status TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `)
}
pgInit().catch(e=>console.error("PG init error",e))

app.post("/api/db/seed", async (_req,res)=>{
  await pgPool.query(`INSERT INTO applications(id, applicant, product, amount, status)
    VALUES ('app-001','John Smith','Personal Loan',12000,'SUBMITTED')
    ON CONFLICT (id) DO NOTHING;
  `)
  res.json({ok:true})
})
app.get("/api/db/apps", async (_req,res)=>{
  const r = await pgPool.query("SELECT * FROM applications ORDER BY created_at DESC")
  res.json({ items: r.rows })
})

// MinIO
const minioClient = new Minio.Client({
  endPoint: MINIO_ENDPOINT,
  port: parseInt(MINIO_PORT,10),
  useSSL: MINIO_USE_SSL === 'true',
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})
async function ensureBucket(){
  try {
    const exists = await minioClient.bucketExists(MINIO_BUCKET)
    if(!exists) await minioClient.makeBucket(MINIO_BUCKET,'us-east-1')
  } catch(e){ /* bucket may already exist */ }
}
ensureBucket()
app.get("/api/files/presign", async (req,res)=>{
  const key = (req.query.key as string) || `uploads/${Date.now()}.bin`
  const uploadUrl = await minioClient.presignedPutObject(MINIO_BUCKET, key, 60*5)
  const getUrl = await minioClient.presignedGetObject(MINIO_BUCKET, key, 60*60)
  res.json({ uploadUrl, getUrl, bucket: MINIO_BUCKET, key })
})

// SQS (LocalStack)
const sqs = new SQSClient({ region: AWS_REGION, endpoint: SQS_ENDPOINT })
app.post("/api/queue/test", async (req,res)=>{
  const message = req.body || { demo: true, at: new Date().toISOString() }
  const out = await sqs.send(new SendMessageCommand({ QueueUrl: SQS_QUEUE_URL, MessageBody: JSON.stringify(message) }))
  res.json({ ok: true, messageId: out.MessageId })
})

// ======= AI Copilot FAQ (local JSON, simple matcher) =======
function score(text:string, q:string){
  const t = text.toLowerCase(), qq=q.toLowerCase().split(/\s+/).filter(Boolean)
  return qq.reduce((s,w)=> s + (t.includes(w)?1:0), 0)
}
app.get("/api/copilot/faq", (req,res)=>{
  const q = (req.query.q as string || '').trim()
  if(!q) return res.json({ query:q, hits:[] })
  const hits = (faqs as any[]).map(f=>({ ...f, _score: score(`${f.q} ${f.a}`, q) }))
                  .filter(h=> h._score>0)
                  .sort((a,b)=> b._score - a._score)
                  .slice(0,5)
  res.json({ query:q, hits })
})

const port = process.env.PORT || 8080;
app.listen(port, () => console.log("BFF listening on " + port));
