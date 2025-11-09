import React from 'react'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
type AppRec = { id:string, applicant:string, product:string, amount:number, custom?:any, kyc?:any, bureau?:any, status:string }
export const Applications:React.FC=()=>{ const [items,setItems]=React.useState<AppRec[]>([])
React.useEffect(()=>{ fetch(API+'/api/uw/applications').then(r=>r.json()).then(d=>setItems(d.items)) },[])
return (<div className="p-6 space-y-4">
  <div className="text-lg font-semibold">Applications</div>
  <div className="card">
    <div className="p-3 border-b font-medium">({items.length})</div>
    <div className="divide-y">{items.map(a=>(
      <div key={a.id} className="p-3">
        <div className="flex items-center justify-between"><div className="font-medium">{a.applicant} • {a.product}</div><div className="text-sm">{a.status}</div></div>
        <div className="text-sm text-gray-600">Amount: ${a.amount}</div>
        <pre className="text-xs bg-gray-50 p-2 rounded border mt-2">{JSON.stringify(a.custom||{},null,2)}</pre>
      </div>
    ))}</div>
  </div>
</div>)}
