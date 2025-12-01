import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AdminShell } from './ui/AdminShell'
import { Organizations } from './pages/Organizations'
import { Dashboard } from './pages/Dashboard'
import { TestPage } from './pages/TestPage'
import { ProtectedRoute } from './components/ProtectedRoute'

const Settings = () => <div className="p-6"><h1 className="text-2xl font-bold">System Settings</h1><p>Configure system-wide settings and preferences.</p></div>
const Analytics = () => <div className="p-6"><h1 className="text-2xl font-bold">Analytics</h1><p>View system analytics and performance metrics.</p></div>
const AuditLogs = () => <div className="p-6"><h1 className="text-2xl font-bold">Audit Logs</h1><p>View system audit logs and user activity.</p></div>

function App() {
  return (
    <BrowserRouter>
      <ProtectedRoute allowedRoles={['admin']}>
        <Routes>
          <Route path="/" element={<AdminShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="organizations" element={<Organizations />} />
            <Route path="settings" element={<Settings />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="test" element={<TestPage />} />
            <Route path="*" element={<div className="p-6">Not Found</div>} />
          </Route>
        </Routes>
      </ProtectedRoute>
    </BrowserRouter>
  )
}
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
