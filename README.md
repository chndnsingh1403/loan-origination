# Originate Lite – Full Stack (Docker)
Included apps (with mock APIs):
- Admin Portal (React/Tailwind)
- Tenant Admin (Branding, Feature Flags, Workflow Builder)
- Underwriter Console (Queue, Applications, Decisioning)
- Broker/Dealer Portal (Leads, Applications, Offers)
- BFF API (Express/TypeScript) with:
  - Config endpoints
  - Mock data for UIs
  - OpenAPI stub
  - Webhook (HMAC) tester
  - Postgres integration (seed + list)
  - MinIO presigned uploads (S3-compatible)
  - LocalStack SQS send
  - AI Copilot FAQ search (local JSON)

Infra (via Docker):
- Postgres (db: originate / user: appuser / pass: apppass)
- MinIO (S3-compatible, console on :9001)
- LocalStack (SQS on :4566)

Run:
  docker compose up --build

Key endpoints:
- Seed DB: POST http://localhost:8080/api/db/seed
- List DB apps: GET http://localhost:8080/api/db/apps
- Presign upload: GET http://localhost:8080/api/files/presign?key=path.ext
- Send SQS message: POST http://localhost:8080/api/queue/test
- Copilot FAQ: GET http://localhost:8080/api/copilot/faq?q=enable e-sign
- OpenAPI stub: GET http://localhost:8080/v1/openapi.json
