import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
type Flag={ key:string, enabled:boolean, description?:string }

export const FeatureFlags:React.FC=()=>{
  const [flags,setFlags]=React.useState<Flag[]>([])
  const load=()=> fetch(API+'/api/config/feature-flags').then(r=>r.json()).then(setFlags)
  React.useEffect(()=>{ load() },[])
  const toggle= (k:string)=> setFlags(flags.map(f=> f.key===k? {...f, enabled:!f.enabled}: f ))
  const save= async()=>{ await fetch(API+'/api/config/feature-flags',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(flags)}); alert('Saved!'); load() }
  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">Feature Flags</div>
      <div className="card divide-y">
        {flags.map(f=> (
          <div key={f.key} className="p-4 flex items-center justify-between">
            <div><div className="font-medium">{f.key}</div><div className="text-sm text-gray-500">{f.description||''}</div></div>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={()=>toggle(f.key)} /><span className="text-sm">{f.enabled? 'Enabled':'Disabled'}</span></label>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" onClick={save}>Save</button>
    </div>
  )
}
