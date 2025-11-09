import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
type Item = { id:string, applicant:string, product:string, status:string, submitted:string, score?:number }
export const Queue:React.FC=()=>{ const [items,setItems]=React.useState<Item[]>([]); const [q,setQ]=React.useState(''); const [status,setStatus]=React.useState('All')
React.useEffect(()=>{ const url = new URL('/api/uw/queue', API); url.searchParams.set('q', q); url.searchParams.set('status', status); fetch(url.toString()).then(r=>r.json()).then(d=>setItems(d.items)) },[q,status])
return (<div className="p-6 space-y-4">
  <div className="text-lg font-semibold">Underwriter Queue</div>
  <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
    <input className="input" placeholder="Search applicant or product..." value={q} onChange={e=>setQ(e.target.value)} />
    <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
      <option>All</option><option>SUBMITTED</option><option>UNDER_REVIEW</option><option>DECIDED</option>
    </select>
    <div className="flex justify-end"><button className="btn btn-primary">Assign To Me</button></div>
  </div>
  <div className="card"><div className="p-3 border-b font-medium">Items ({items.length})</div>
    <div className="divide-y">{items.map(i=>(
      <div key={i.id} className="p-3 flex items-center gap-4">
        <div className="flex-1"><div className="font-medium">{i.applicant}</div><div className="text-sm text-gray-500">{i.product}</div></div>
        <div className="w-32 text-sm">{i.status}</div>
        <div className="w-32 text-sm">Score {i.score ?? '-'}</div>
        <div className="w-40 text-sm text-gray-500">{i.submitted}</div>
        <div className="flex gap-2"><a className="btn" href={"/applications?id="+i.id}>Open</a></div>
      </div>
    ))}</div>
  </div>
</div>)}
