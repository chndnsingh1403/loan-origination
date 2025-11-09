import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, FileText, Settings, Users, Shield, Workflow } from 'lucide-react'
import React from 'react'

const tabs = [
  { key: 'products', label: 'Products', to: '#' },
  { key: 'categories', label: 'Product Categories', to: '#' },
  { key: 'application-templates', label: 'Application Templates', to: '/application-templates' },
  { key: 'bundles', label: 'Config Bundles', to: '#' },
  { key: 'deployment', label: 'Deployment', to: '#' },
]

export const AdminShell: React.FC = () => {
  const location = useLocation()
  const activeTab = tabs.find(t => location.pathname.includes(t.key))?.key ?? 'application-templates'

  return (
    <div className="h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b">
          <div className="font-semibold">Quantum Cadence Admin Portal</div>
          <div className="text-xs text-gray-500">No-code configuration for products, forms & system</div>
        </div>
        <nav className="p-2 overflow-y-auto h-[calc(100vh-64px)]">
          <div className="sidebar-section">Dashboards</div>
          <a className="sidebar-link" href="#"><LayoutDashboard size={16}/> Admin Dashboard</a>
          <a className="sidebar-link" href="#"><LayoutDashboard size={16}/> Manager Dashboard</a>
          <a className="sidebar-link" href="#"><LayoutDashboard size={16}/> Underwriter Dashboard</a>

          <div className="sidebar-section">Underwriting</div>
          <a className="sidebar-link" href="#"><FileText size={16}/> My Applications</a>
          <a className="sidebar-link" href="#"><FileText size={16}/> All Applications</a>
          <a className="sidebar-link" href="#"><Workflow size={16}/> Queue Assignments</a>
          <a className="sidebar-link" href="#"><Workflow size={16}/> Queue Management</a>

          <div className="sidebar-section">Policy Management</div>
          <a className="sidebar-link" href="#"><Shield size={16}/> Policies</a>
          <a className="sidebar-link" href="#"><Shield size={16}/> Policy Evaluations</a>
          <a className="sidebar-link" href="#"><Shield size={16}/> Policy Management</a>
          <a className="sidebar-link" href="#"><Shield size={16}/> Policy Tester</a>

          <div className="sidebar-section">Administration</div>
          <a className="sidebar-link" href="#"><Users size={16}/> Users</a>
          <a className="sidebar-link" href="#"><Users size={16}/> Role Permissions</a>
          <a className="sidebar-link" href="#"><Settings size={16}/> Nav Management</a>
          <Link className="sidebar-link" to="/application-templates"><Settings size={16}/> Config Studio</Link>

          <div className="sidebar-section">System</div>
          <a className="sidebar-link" href="#"><Settings size={16}/> System Settings</a>
        </nav>
      </aside>

      <main className="overflow-y-auto">
        <div className="p-4 border-b bg-white flex items-center gap-2">
          {tabs.map(t => (
            t.to === '#' ? (
              <button key={t.key} className={`top-tab ${activeTab===t.key?'top-tab-active':'top-tab-inactive'}`}>{t.label}</button>
            ) : (
              <Link key={t.key} to={t.to} className={`top-tab ${activeTab===t.key?'top-tab-active':'top-tab-inactive'}`}>{t.label}</Link>
            )
          ))}
        </div>
        <Outlet />
      </main>
    </div>
  )
}
