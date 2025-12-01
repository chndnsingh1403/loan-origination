import React from 'react'
import { authenticatedFetch } from '../utils/auth'
type Offer = { id:string, customer:string, product:string, amount:number, rate:number, created:string }
export const Offers:React.FC=()=>{ const [items,setItems]=React.useState<Offer[]>([])
React.useEffect(()=>{ 
  const fetchOffers = async () => {
    try {
      const response = await authenticatedFetch('/api/broker/offers');
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
      setItems([]);
    }
  };
  fetchOffers();
},[])
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
