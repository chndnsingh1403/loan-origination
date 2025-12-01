import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import './index.css'
import { Branding } from './pages/Branding'
import { FeatureFlags } from './pages/FeatureFlags'
import { WorkflowBuilder } from './pages/WorkflowBuilder'
import LoanProducts from './pages/LoanProducts'
import { ApplicationTemplates } from './pages/ApplicationTemplates'
import Users from './pages/Users'
import { Queues } from './pages/Queues'
import { TaskSetups } from './pages/TaskSetups'
import RoleManagement from './pages/RoleManagement'
import { ProtectedRoute } from './components/ProtectedRoute'
import { getUserDisplayName, logout } from './utils/auth'

function Shell({children}:{children:React.ReactNode}){
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
    <div className="h-screen grid grid-cols-[260px_1fr] dark:bg-gray-900">
      <aside className="border-r bg-white dark:bg-gray-800 dark:border-gray-700">
        <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <div className="font-semibold dark:text-white">Tenant Admin</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Configure Your Organization</div>
          </div>
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
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Products & Templates</div>
          <NavLink to="/loan-products" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Loan Products</NavLink>
          <NavLink to="/application-templates" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Application Templates</NavLink>
          <NavLink to="/task-setups" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Task Templates</NavLink>
          
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mt-4">User Management</div>
          <NavLink to="/users" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Users & Roles</NavLink>
          <NavLink to="/role-management" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Role Management</NavLink>
          <NavLink to="/queues" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Work Queues</NavLink>
          
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mt-4">Customization</div>
          <NavLink to="/branding" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Branding</NavLink>
          <NavLink to="/features" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Feature Flags</NavLink>
          <NavLink to="/workflow" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100 dark:bg-gray-700':'dark:text-gray-300 dark:hover:bg-gray-700'}`}>Workflow Builder</NavLink>
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
      <main className="overflow-y-auto dark:bg-gray-900">{children}</main>
    </div>
  )
}

function App(){
  return (
    <BrowserRouter>
      <ProtectedRoute allowedRoles={['tenant_admin', 'admin']}>
        <Routes>
          <Route path="/" element={<Shell><Navigate to="/loan-products" replace/></Shell>} />
          <Route path="/loan-products" element={<Shell><LoanProducts/></Shell>} />
          <Route path="/application-templates" element={<Shell><ApplicationTemplates/></Shell>} />
          <Route path="/task-setups" element={<Shell><TaskSetups/></Shell>} />
          <Route path="/users" element={<Shell><Users/></Shell>} />
          <Route path="/role-management" element={<Shell><RoleManagement/></Shell>} />
          <Route path="/queues" element={<Shell><Queues/></Shell>} />
          <Route path="/branding" element={<Shell><Branding/></Shell>} />
          <Route path="/features" element={<Shell><FeatureFlags/></Shell>} />
          <Route path="/workflow" element={<Shell><WorkflowBuilder/></Shell>} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Routes>
      </ProtectedRoute>
    </BrowserRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App/>)
