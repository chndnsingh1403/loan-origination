import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
type WF = { states:string[], transitions:{from:string,to:string,guard?:string,auto?:string}[] }

export const WorkflowBuilder:React.FC=()=>{
  const [wf,setWf]=React.useState<WF>({states:[], transitions:[]})
  const [stateInput,setStateInput]=React.useState('')
  const [from,setFrom]=React.useState(''); const [to,setTo]=React.useState(''); const [guard,setGuard]=React.useState('')
  React.useEffect(()=>{ fetch(API+'/api/config/workflow').then(r=>r.json()).then(setWf) },[])
  const addState=()=>{ if(stateInput && !wf.states.includes(stateInput)){ setWf({...wf, states:[...wf.states, stateInput]}); setStateInput('') } }
  const addTransition=()=>{ if(from && to){ setWf({...wf, transitions:[...wf.transitions,{from,to,guard:guard||undefined}]}); setFrom(''); setTo(''); setGuard('') } }
  const save= async()=>{ await fetch(API+'/api/config/workflow',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(wf)}); alert('Saved!') }
  return (
    <div className="p-6 grid gap-4 md:grid-cols-2">
      <div className="card p-4 space-y-3">
        <div className="text-lg font-semibold">States</div>
        <div className="flex gap-2"><input className="input flex-1" placeholder="Add state e.g. DRAFT" value={stateInput} onChange={e=>setStateInput(e.target.value)} /><button className="btn btn-primary" onClick={addState}>Add</button></div>
        <div className="flex flex-wrap gap-2">{wf.states.map(s=> <span key={s} className="px-2 py-1 rounded bg-gray-200 text-sm">{s}</span>)}</div>
      </div>
      <div className="card p-4 space-y-3">
        <div className="text-lg font-semibold">Transitions</div>
        <div className="grid grid-cols-3 gap-2">
          <select className="select" value={from} onChange={e=>setFrom(e.target.value)}><option value="">From…</option>{wf.states.map(s=> <option key={s}>{s}</option>)}</select>
          <select className="select" value={to} onChange={e=>setTo(e.target.value)}><option value="">To…</option>{wf.states.map(s=> <option key={s}>{s}</option>)}</select>
          <input className="input" placeholder="Guard (optional)" value={guard} onChange={e=>setGuard(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={addTransition}>Add Transition</button>
        <div className="divide-y">{wf.transitions.map((t,i)=> <div key={i} className="py-2 text-sm">{t.from} → {t.to} {t.guard? `(guard: ${t.guard})`:''}</div>)}</div>
      </div>
      <div className="card p-4 md:col-span-2">
        <div className="flex items-center justify-between mb-2"><div className="font-medium">JSON Preview</div><button className="btn btn-primary" onClick={save}>Save</button></div>
        <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded border">{JSON.stringify(wf,null,2)}</pre>
      </div>
    </div>
  )
}
