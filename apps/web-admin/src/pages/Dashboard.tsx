import React from 'react'
import { authenticatedFetch } from '../utils/auth'

interface DashboardStats {
  totalOrganizations: number
  totalSystemUsers: number
  activeOrganizations: number
  systemHealth: string
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = React.useState<DashboardStats>({
    totalOrganizations: 0,
    totalSystemUsers: 0,
    activeOrganizations: 0,
    systemHealth: 'Unknown'
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Fetch organizations count
        const orgsResponse = await authenticatedFetch('/api/organizations')
        const orgsData = await orgsResponse.json()
        
        // Fetch total users count
        const usersResponse = await authenticatedFetch('/api/users')
        const usersData = await usersResponse.json()
        
        setStats({
          totalOrganizations: orgsData.items?.length || 0,
          totalSystemUsers: usersData.items?.length || 0,
          activeOrganizations: orgsData.items?.length || 0, // All orgs are active by default
          systemHealth: 'Healthy'
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setError(error instanceof Error ? error.message : 'Failed to load dashboard')
        setStats({
          totalOrganizations: 0,
          totalSystemUsers: 0,
          activeOrganizations: 0,
          systemHealth: 'Unknown'
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-2xl font-bold mb-6">Admin Dashboard</div>
        <div className="flex items-center space-x-2 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Welcome to the admin portal. Here's an overview of your system.</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.totalOrganizations}</div>
          <div className="text-sm text-gray-600">Total Organizations</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-green-600">{stats.activeOrganizations}</div>
          <div className="text-sm text-gray-600">Active Organizations</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.totalSystemUsers}</div>
          <div className="text-sm text-gray-600">Total System Users</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-orange-600">{stats.systemHealth}</div>
          <div className="text-sm text-gray-600">System Status</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-4">
        <div className="font-medium mb-4">Quick Actions</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button 
            onClick={() => window.location.href = '/organizations'}
            className="btn btn-primary"
          >
            � Manage Organizations
          </button>
          <button 
            onClick={async () => {
              try {
                const response = await authenticatedFetch('/api/system/health')
                const result = await response.json()
                alert(`System Health Check\n\nStatus: ${result.status || 'Unknown'}\nDatabase: ${result.database || 'Unknown'}\nTimestamp: ${new Date().toLocaleString()}`)
              } catch (err) {
                console.error('Health check error:', err)
                alert('Failed to check system health. Check console for details.')
              }
            }}
            className="btn btn-outline"
          >
            🏥 System Health Check
          </button>
        </div>
      </div>

      {/* System Information */}
      <div className="card p-6">
        <div className="font-medium mb-4">System Information</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Platform Version</div>
            <div className="font-medium">Originate Lite v1.0</div>
          </div>
          <div>
            <div className="text-gray-500">Database Status</div>
            <div className="font-medium text-green-600">● Connected</div>
          </div>
          <div>
            <div className="text-gray-500">Environment</div>
            <div className="font-medium">Development</div>
          </div>
          <div>
            <div className="text-gray-500">Last Backup</div>
            <div className="font-medium text-gray-400">Not configured</div>
          </div>
        </div>
      </div>
    </div>
  )
}