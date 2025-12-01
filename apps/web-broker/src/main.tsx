import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import './index.css'
import { Pipeline } from './pages/Pipeline'
import { Applications } from './pages/Applications'
import { NewApplication } from './pages/NewApplication'
import { Customers } from './pages/Customers'
import { Documents } from './pages/Documents'
import { Products } from './pages/Products'
import { Offers } from './pages/Offers'
import { ProtectedRoute } from './components/ProtectedRoute'
import { getUserDisplayName, logout } from './utils/auth'

function Shell(){
  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <div className="h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r bg-white flex flex-col">
        <div className="p-4 border-b"><div className="font-semibold">Broker Portal</div></div>
        <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
          <NavLink to="/pipeline" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-100'}`}>
            <span>📊</span> Pipeline
          </NavLink>
          <NavLink to="/applications" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-100'}`}>
            <span>📝</span> Applications
          </NavLink>
          <NavLink to="/customers" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-100'}`}>
            <span>👥</span> Customers
          </NavLink>
          <NavLink to="/documents" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-100'}`}>
            <span>📁</span> Documents
          </NavLink>
          <NavLink to="/products" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-100'}`}>
            <span>💼</span> Products
          </NavLink>
          <NavLink to="/offers" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 text-blue-700':'text-gray-700 hover:bg-gray-100'}`}>
            <span>✅</span> Offers
          </NavLink>
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
      <main className="overflow-y-auto bg-gray-50">
        <Routes>
          <Route path="/" element={<Navigate to="/pipeline" replace/>} />
          <Route path="/pipeline" element={<Pipeline/>} />
          <Route path="/applications" element={<Applications/>} />
          <Route path="/new-application" element={<NewApplication/>} />
          <Route path="/customers" element={<Customers/>} />
          <Route path="/documents" element={<Documents/>} />
          <Route path="/products" element={<Products/>} />
          <Route path="/offers" element={<Offers/>} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </main>
    </div>
  )
}

function App(){
  return (
    <BrowserRouter>
      <ProtectedRoute allowedRoles={['broker', 'admin']}>
        <Shell/>
      </ProtectedRoute>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App/>)
