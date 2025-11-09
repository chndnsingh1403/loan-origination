import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import './index.css'
import { Queue } from './pages/Queue'
import { Applications } from './pages/Applications'
import { Decisioning } from './pages/Decisioning'

function Shell(){
  return (
    <div className="h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b"><div className="font-semibold">Underwriter Console</div></div>
        <nav className="p-2 space-y-1">
          <NavLink to="/queue" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Queue</NavLink>
          <NavLink to="/applications" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Applications</NavLink>
          <NavLink to="/decisioning" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Decisioning</NavLink>
        </nav>
      </aside>
      <main className="overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/queue" replace/>} />
          <Route path="/queue" element={<Queue/>} />
          <Route path="/applications" element={<Applications/>} />
          <Route path="/decisioning" element={<Decisioning/>} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Shell/>)
