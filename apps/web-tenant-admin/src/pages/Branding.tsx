import React from 'react'
const API= import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const Branding:React.FC=()=>{
  const [logoUrl,setLogoUrl]=React.useState('')
  const [primary,setPrimary]=React.useState('#155EEF')
  const [mode,setMode]=React.useState<'light'|'dark'>('light')

  React.useEffect(()=>{
    fetch(API+'/api/config/branding').then(r=>r.json()).then(b=>{ setLogoUrl(b.logoUrl||''); setPrimary(b.colors?.primary||'#155EEF'); setMode(b.mode||'light') })
  },[])

  const save=async()=>{
    await fetch(API+'/api/config/branding',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({logoUrl:logoUrl, colors:{primary:primary}, mode})})
    alert('Saved!')
  }

  return (
    <div className="p-6 space-y-4">
      <div className="text-lg font-semibold">Branding</div>
      <div className="card p-4 space-y-3">
        <div><label className="block text-sm mb-1">Logo URL</label><input className="input" value={logoUrl} onChange={e=>setLogoUrl(e.target.value)} /></div>
        <div><label className="block text-sm mb-1">Primary Color</label><input className="input" type="color" value={primary} onChange={e=>setPrimary(e.target.value)} /></div>
        <div><label className="block text-sm mb-1">Mode</label>
          <select className="select" value={mode} onChange={e=>setMode(e.target.value as any)}><option value="light">Light</option><option value="dark">Dark</option></select>
        </div>
        <div className="pt-2"><button className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
    </div>
  )
}
