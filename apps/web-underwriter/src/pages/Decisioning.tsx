import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
export const Decisioning:React.FC=()=>{ const [result,setResult]=React.useState<any>(null); const [appId,setAppId]=React.useState('app-001')
const run= async()=>{ const r = await fetch(API+'/api/uw/decision?appId='+appId).then(r=>r.json()); setResult(r) }
return (<div className="p-6 space-y-4">
  <div className="text-lg font-semibold">Decisioning</div>
  <div className="card p-4 space-y-3">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      <input className="input" value={appId} onChange={e=>setAppId(e.target.value)} />
      <button className="btn btn-primary" onClick={run}>Run Scorecard</button>
    </div>
    <pre className="text-xs bg-gray-50 p-2 rounded border">{result? JSON.stringify(result,null,2): 'No results yet.'}</pre>
  </div>
</div>)}
