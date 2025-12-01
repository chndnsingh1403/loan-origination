import React from 'react'
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
  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <div className="h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b">
          <div className="font-semibold">Tenant Admin</div>
          <div className="text-xs text-gray-500">Configure Your Organization</div>
        </div>
        <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Products & Templates</div>
          <NavLink to="/loan-products" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Loan Products</NavLink>
          <NavLink to="/application-templates" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Application Templates</NavLink>
          <NavLink to="/task-setups" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Task Templates</NavLink>
          
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase mt-4">User Management</div>
          <NavLink to="/users" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Users & Roles</NavLink>
          <NavLink to="/role-management" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Role Management</NavLink>
          <NavLink to="/queues" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Work Queues</NavLink>
          
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase mt-4">Customization</div>
          <NavLink to="/branding" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Branding</NavLink>
          <NavLink to="/features" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Feature Flags</NavLink>
          <NavLink to="/workflow" className={({isActive})=>`block px-3 py-2 rounded-md ${isActive?'bg-gray-100':''}`}>Workflow Builder</NavLink>
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
      <main className="overflow-y-auto">{children}</main>
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
