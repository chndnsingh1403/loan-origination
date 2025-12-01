import React, { useState, useEffect } from 'react'
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
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <div className="h-screen grid grid-cols-[240px_1fr] dark:bg-gray-900">
      <aside className="border-r bg-white dark:bg-gray-800 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="font-semibold dark:text-white">Broker Portal</div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
        <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
          <NavLink to="/pipeline" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <span>📊</span> Pipeline
          </NavLink>
          <NavLink to="/applications" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <span>📝</span> Applications
          </NavLink>
          <NavLink to="/customers" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <span>👥</span> Customers
          </NavLink>
          <NavLink to="/documents" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <span>📁</span> Documents
          </NavLink>
          <NavLink to="/products" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <span>💼</span> Products
          </NavLink>
          <NavLink to="/offers" className={({isActive})=>`flex items-center gap-2 px-3 py-2 rounded-md ${isActive?'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <span>✅</span> Offers
          </NavLink>
        </nav>
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{getUserDisplayName()}</div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="overflow-y-auto bg-gray-50 dark:bg-gray-900">
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
