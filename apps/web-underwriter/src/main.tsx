import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import './index.css'
import { Dashboard } from './pages/Dashboard'
import { Queue } from './pages/Queue'
import { Applications } from './pages/Applications'
import { ApplicationReview } from './pages/ApplicationReview'
import { Decisioning } from './pages/Decisioning'
import { ProtectedRoute } from './components/ProtectedRoute'
import { getUserDisplayName, logout } from './utils/auth'

function Shell(){
  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <div className="h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b"><div className="font-semibold">Underwriter Console</div></div>
        <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
          <NavLink to="/dashboard" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>📊 Dashboard</NavLink>
          <NavLink to="/queue" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>📋 Queue</NavLink>
          <NavLink to="/applications" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>📄 Applications</NavLink>
          <NavLink to="/decisioning" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>⚖️ Decisioning</NavLink>
        </nav>
        <div className="p-4 border-t bg-gray-50">
          <div className="text-sm font-medium text-gray-900">{getUserDisplayName()}</div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="overflow-y-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/queue" element={<Queue/>} />
          <Route path="/applications" element={<Applications/>} />
          <Route path="/application/:id" element={<ApplicationReview/>} />
          <Route path="/decisioning" element={<Decisioning/>} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}

function App(){
  return (
    <BrowserRouter>
      <ProtectedRoute allowedRoles={['underwriter', 'admin']}>
        <Shell/>
      </ProtectedRoute>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App/>)
