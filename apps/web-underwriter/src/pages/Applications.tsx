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

export const Applications: React.FC = () => {
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchApplications()
  }, [statusFilter])

  const fetchApplications = async () => {
    try {
      let url = '/api/underwriter/applications'
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`
      }
      
      console.log('Fetching applications from:', url)
      const response = await authenticatedFetch(url)
      console.log('Response status:', response.status, 'OK:', response.ok)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Applications data:', data)
        setApplications(data.items || [])
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Failed to fetch applications:', response.status, errorData)
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
    } finally {
      setLoading(false)
    }
  }

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
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500">Loading applications...</div></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">All Applications</h1>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="underwriting">Underwriting</option>
            <option value="on_hold">On Hold</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
          <button
            onClick={fetchApplications}
            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-gray-400 text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Applications Found</h3>
          <p className="text-gray-500">There are no applications matching your current filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Application #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Broker</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days in Queue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/applications/${app.id}`)}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{app.application_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{app.customer}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{app.product}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${app.requested_amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{app.broker}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{app.submitted}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{app.days_in_queue} days</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/application/${app.id}`)
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
