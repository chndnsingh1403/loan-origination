import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AdminShell } from './ui/AdminShell'
import { ApplicationTemplates } from './pages/ApplicationTemplates'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminShell />}>
          <Route index element={<Navigate to="/application-templates" replace />} />
          <Route path="application-templates" element={<ApplicationTemplates />} />
          <Route path="*" element={<div className="p-6">Not Found</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
