import React from 'react'
import { authenticatedFetch } from '../utils/auth'
type Lead = { id:string, customer:string, product:string, status:string, created:string }
export const Leads:React.FC=()=>{ const [items,setItems]=React.useState<Lead[]>([]); const [q,setQ]=React.useState('')
React.useEffect(()=>{ 
  const fetchLeads = async () => {
    try {
      const url = `/api/broker/leads${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      const response = await authenticatedFetch(url);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
      setItems([]);
    }
  };
  fetchLeads();
},[q])
return (<div className="p-6 space-y-4">
  <div className="text-lg font-semibold">Leads</div>
  <div className="card p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
    <input className="input" placeholder="Search customer..." value={q} onChange={e=>setQ(e.target.value)} />
    <div></div><div className="flex justify-end"><a className="btn btn-primary" href="/applications">New Application</a></div>
  </div>
  <div className="card"><div className="p-3 border-b font-medium">({items.length})</div>
    <div className="divide-y">{items.map(l=>(
      <div key={l.id} className="p-3 flex items-center justify-between">
        <div><div className="font-medium">{l.customer}</div><div className="text-sm text-gray-600">{l.product}</div></div>
        <div className="text-sm">{l.status}</div>
        <div className="text-xs text-gray-500">{l.created}</div>
      </div>
    ))}</div>
  </div>
</div>)}
