import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import './index.css'
import { Leads } from './pages/Leads'
import { Applications } from './pages/Applications'
import { Offers } from './pages/Offers'

function Shell(){
  return (
    <div className="h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b"><div className="font-semibold">Broker / Dealer Portal</div></div>
        <nav className="p-2 space-y-1">
          <NavLink to="/leads" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Leads</NavLink>
          <NavLink to="/applications" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Applications</NavLink>
          <NavLink to="/offers" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Offers</NavLink>
        </nav>
      </aside>
      <main className="overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/leads" replace/>} />
          <Route path="/leads" element={<Leads/>} />
          <Route path="/applications" element={<Applications/>} />
          <Route path="/offers" element={<Offers/>} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Shell/>)
