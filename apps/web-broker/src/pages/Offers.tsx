import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
type Offer = { id:string, customer:string, product:string, apr:number, status:string }
export const Offers:React.FC=()=>{ const [items,setItems]=React.useState<Offer[]>([])
React.useEffect(()=>{ fetch(API+'/api/broker/offers').then(r=>r.json()).then(d=>setItems(d.items)) },[])
return (<div className="p-6 space-y-4">
  <div className="text-lg font-semibold">Offers</div>
  <div className="card"><div className="p-3 border-b font-medium">({items.length})</div>
    <div className="divide-y">{items.map(o=>(
      <div key={o.id} className="p-3 flex items-center justify-between">
        <div><div className="font-medium">{o.customer}</div><div className="text-sm text-gray-600">{o.product}</div></div>
        <div className="text-sm">APR {o.apr}%</div>
        <div className="text-xs text-gray-500">{o.status}</div>
      </div>
    ))}</div>
  </div>
</div>)}
