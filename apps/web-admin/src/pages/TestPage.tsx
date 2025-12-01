import React from 'react'

export const TestPage: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>
      <p>This is a test page to verify the routing is working.</p>
      <div className="card p-4 mt-4">
        <h2 className="font-semibold mb-2">Card Test</h2>
        <p>This card should have styling applied.</p>
        <button className="btn btn-primary mt-2">Test Button</button>
      </div>
    </div>
  )
}