import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import './index.css'
import { Branding } from './pages/Branding'
import { FeatureFlags } from './pages/FeatureFlags'
import { WorkflowBuilder } from './pages/WorkflowBuilder'

function Shell({children}:{children:React.ReactNode}){
  return (
    <div className="h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b">
          <div className="font-semibold">Tenant Admin</div>
          <div className="text-xs text-gray-500">Branding • Features • Workflow</div>
        </div>
        <nav className="p-2 space-y-1">
          <NavLink to="/branding" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Branding</NavLink>
          <NavLink to="/features" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Feature Flags</NavLink>
          <NavLink to="/workflow" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Workflow Builder</NavLink>
        </nav>
      </aside>
      <main className="overflow-y-auto">{children}</main>
    </div>
  )
}

function App(){
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell><Navigate to="/branding" replace/></Shell>} />
        <Route path="/branding" element={<Shell><Branding/></Shell>} />
        <Route path="/features" element={<Shell><FeatureFlags/></Shell>} />
        <Route path="/workflow" element={<Shell><WorkflowBuilder/></Shell>} />
        <Route path="*" element={<div className="p-6">Not Found</div>} />
      </Routes>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App/>)
