import { Outlet, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, LogOut, Building2, Moon, Sun } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { getUserDisplayName, logout } from '../utils/auth'
import { SessionStatus } from '../components/SessionStatus'

const tabs = [
  { key: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { key: 'organizations', label: 'Organizations', to: '/organizations' },
]

export const AdminShell: React.FC = () => {
  const location = useLocation()
  const activeTab = tabs.find(t => location.pathname.includes(t.key))?.key ?? 'dashboard'
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
            <div className="font-semibold dark:text-white">Admin Portal</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">System Administration & Configuration</div>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} className="text-gray-600" />}
          </button>
        </div>
        <nav className="p-2 overflow-y-auto h-[calc(100vh-128px)]">
          <div className="sidebar-section dark:text-gray-400">Overview</div>
          <Link className="sidebar-link dark:text-gray-300 dark:hover:bg-gray-700" to="/dashboard">
            <LayoutDashboard size={16}/> Dashboard
          </Link>

          <div className="sidebar-section dark:text-gray-400">Tenant Management</div>
          <Link className="sidebar-link dark:text-gray-300 dark:hover:bg-gray-700" to="/organizations">
            <Building2 size={16}/> Organizations
          </Link>
        </nav>
        
        {/* User info and logout */}
        <div className="p-4 border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{getUserDisplayName()}</div>
            <SessionStatus className="ml-2" />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="overflow-y-auto dark:bg-gray-900">
        <div className="p-4 border-b bg-white dark:bg-gray-800 dark:border-gray-700 flex items-center gap-2">
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
