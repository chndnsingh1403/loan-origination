import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticatedFetch } from '../utils/auth'

type Application = {
  id: string
  application_number: string
  customer: string
  product: string
  status: string
  requested_amount: number
  broker: string
  submitted: string
  days_in_queue: number
}

export const Queue: React.FC = () => {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, on_hold: 0 })

  useEffect(() => {
    fetchApplications()
    fetchStats()
  }, [statusFilter])

  const fetchApplications = async () => {
    try {
      const url = new URL('/api/underwriter/applications', window.location.origin)
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter)
      }
      
      const response = await authenticatedFetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setApplications(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await authenticatedFetch('/api/underwriter/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data.queue || { total: 0, pending: 0, in_progress: 0, on_hold: 0 })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const filteredApps = applications.filter(app => {
    const query = searchQuery.toLowerCase()
    return (
      app.application_number.toLowerCase().includes(query) ||
      app.customer.toLowerCase().includes(query) ||
      app.product.toLowerCase().includes(query)
    )
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-blue-100 text-blue-800'
      case 'under_review': return 'bg-yellow-100 text-yellow-800'
      case 'underwriting': return 'bg-purple-100 text-purple-800'
      case 'on_hold': return 'bg-gray-100 text-gray-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'declined': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500">Loading queue...</div></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Application Queue</h1>
        <button
          onClick={fetchApplications}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Queue</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
          <div className="text-2xl font-bold text-gray-900">{stats.in_progress}</div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-gray-500">
          <div className="text-2xl font-bold text-gray-900">{stats.on_hold}</div>
          <div className="text-sm text-gray-600">On Hold</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search by application #, customer, or product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="underwriting">Underwriting</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Application #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days in Queue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery ? 'No applications match your search' : 'No applications in queue'}
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/application/${app.id}`)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{app.application_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.customer}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{app.product}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${Number(app.requested_amount).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{app.broker}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {app.days_in_queue} {app.days_in_queue === 1 ? 'day' : 'days'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/application/${app.id}`)
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Review →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

