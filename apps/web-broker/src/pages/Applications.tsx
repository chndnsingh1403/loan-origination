import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
type App = { id:string, customer:string, product:string, status:string, submitted:string }
export const Applications:React.FC=()=>{ const [items,setItems]=React.useState<App[]>([])
React.useEffect(()=>{ fetch(API+'/api/broker/applications').then(r=>r.json()).then(d=>setItems(d.items)) },[])
return (<div className="p-6 space-y-4">
  <div className="text-lg font-semibold">Applications</div>
  <div className="card"><div className="p-3 border-b font-medium">({items.length})</div>
    <div className="divide-y">{items.map(a=>(
      <div key={a.id} className="p-3 flex items-center justify-between">
        <div><div className="font-medium">{a.customer}</div><div className="text-sm text-gray-600">{a.product}</div></div>
        <div className="text-sm">{a.status}</div>
        <div className="text-xs text-gray-500">{a.submitted}</div>
      </div>
    ))}</div>
  </div>
</div>)}
