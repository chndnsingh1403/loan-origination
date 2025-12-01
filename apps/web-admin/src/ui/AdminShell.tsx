import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Building2 } from 'lucide-react'
import React from 'react'
import { getUserDisplayName, logout } from '../utils/auth'
import { SessionStatus } from '../components/SessionStatus'

const tabs = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { key: 'organizations', label: 'Organizations', to: '/organizations' },
]

export const AdminShell: React.FC = () => {
  const location = useLocation()
  const activeTab = tabs.find(t => location.pathname.includes(t.key))?.key ?? 'dashboard'

  const handleLogout = async () => {
    await logout()
    window.location.reload()
  }

  return (
    <div className="h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r bg-white">
        <div className="p-4 border-b">
          <div className="font-semibold">Admin Portal</div>
          <div className="text-xs text-gray-500">System Administration & Configuration</div>
        </div>
        <nav className="p-2 overflow-y-auto h-[calc(100vh-128px)]">
          <div className="sidebar-section">Overview</div>
          <Link className="sidebar-link" to="/dashboard">
            <LayoutDashboard size={16}/> Dashboard
          </Link>

          <div className="sidebar-section">Tenant Management</div>
          <Link className="sidebar-link" to="/organizations">
            <Building2 size={16}/> Organizations
          </Link>
        </nav>
        
        {/* User info and logout */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-900">{getUserDisplayName()}</div>
            <SessionStatus className="ml-2" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
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
