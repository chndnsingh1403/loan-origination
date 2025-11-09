import React from 'react'
type Template = { id:string; name:string; description:string; status:string; steps:number; products:number; created:string }
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
export const ApplicationTemplates: React.FC = () => {
  const [items, setItems] = React.useState<Template[]>([])
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState('All Templates')
  React.useEffect(() => {
    const url = new URL('/api/templates', API_URL)
    url.searchParams.set('q', q); url.searchParams.set('status', status)
    fetch(url.toString()).then(r => r.json()).then(d => setItems(d.items))
  }, [q, status])
  return (
    <div className="p-6 space-y-4">
      <div><div className="text-lg font-semibold">Application Templates</div><div className="text-sm text-gray-500">Manage application form templates</div></div>
      <div className="card p-4">
        <div className="font-medium mb-3">Filters</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input" placeholder="Search by name or description..." value={q} onChange={e=>setQ(e.target.value)} />
          <select className="select" value={status} onChange={e=>setStatus(e.target.value)}>
            <option>All Templates</option><option>Active</option><option>Inactive</option>
          </select>
          <div className="flex justify-end"><button className="btn btn-primary">+ Add Template</button></div>
        </div>
      </div>
      <div className="card">
        <div className="p-4 border-b font-medium">Templates ({items.length})</div>
        <div className="divide-y">
          {items.map(t => (
            <div key={t.id} className="p-4 flex items-center gap-4">
              <div className="flex-1"><div className="font-medium">{t.name}</div><div className="text-sm text-gray-500">{t.description}</div></div>
              <div className="w-24"><span className="badge badge-success">{t.status}</span></div>
              <div className="w-24 text-sm text-gray-600">Steps {t.steps}</div>
              <div className="w-24 text-sm text-gray-600">Products {t.products}</div>
              <div className="w-32 text-sm text-gray-600">{t.created}</div>
              <div className="flex gap-2"><button className="btn btn-ghost">Configure</button><button className="btn btn-ghost">AI Edit</button><button className="btn btn-ghost" style={{color:'#dc2626'}}>Deactivate</button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
