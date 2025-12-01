import React, { useState, useEffect } from 'react'
import { authenticatedFetch } from '../utils/auth'
import { useNavigate } from 'react-router-dom'

type DashboardStats = {
  total_queue: number
  pending_review: number
  in_progress: number
  on_hold: number
  completed_today: number
  completed_week: number
  completed_month: number
  avg_decision_time_hours: number
  approval_rate: number
  decline_rate: number
}

type RecentApplication = {
  id: string
  application_number: string
  customer_name: string
  requested_amount: number
  status: string
  updated_at: string
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentApps, setRecentApps] = useState<RecentApplication[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [statsRes, recentRes] = await Promise.all([
        authenticatedFetch('/api/underwriter/dashboard/stats'),
        authenticatedFetch('/api/underwriter/dashboard/recent')
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }

      if (recentRes.ok) {
        const data = await recentRes.json()
        setRecentApps(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  const statCards = [
    { label: 'Total Queue', value: stats?.total_queue || 0, color: 'from-blue-500 to-blue-600', icon: '📋' },
    { label: 'Pending Review', value: stats?.pending_review || 0, color: 'from-yellow-500 to-yellow-600', icon: '⏳' },
    { label: 'In Progress', value: stats?.in_progress || 0, color: 'from-orange-500 to-orange-600', icon: '🔄' },
    { label: 'On Hold', value: stats?.on_hold || 0, color: 'from-purple-500 to-purple-600', icon: '⏸️' },
  ]

  const performanceCards = [
    { label: 'Completed Today', value: stats?.completed_today || 0, subtext: 'applications' },
    { label: 'Completed This Week', value: stats?.completed_week || 0, subtext: 'applications' },
    { label: 'Completed This Month', value: stats?.completed_month || 0, subtext: 'applications' },
    { label: 'Avg Decision Time', value: `${stats?.avg_decision_time_hours || 0}h`, subtext: 'hours' },
  ]

  const rateCards = [
    { label: 'Approval Rate', value: `${stats?.approval_rate || 0}%`, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Decline Rate', value: `${stats?.decline_rate || 0}%`, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Underwriter Dashboard
        </h1>
        <p className="text-gray-600 mt-1">Overview of your workload and performance</p>
      </div>

      {/* Queue Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate('/queue')}
          >
            <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center text-2xl mb-4`}>
              {card.icon}
            </div>
            <div className="text-3xl font-bold text-gray-900">{card.value}</div>
            <div className="text-sm text-gray-600 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {performanceCards.map((card) => (
            <div key={card.label} className="border border-gray-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-600 mt-1">{card.label}</div>
              <div className="text-xs text-gray-400 mt-1">{card.subtext}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Decision Rates */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📈 Decision Rates</h2>
          <div className="space-y-3">
            {rateCards.map((card) => (
              <div key={card.label} className={`${card.bg} rounded-lg p-4`}>
                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                <div className="text-sm text-gray-600 mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-md p-6 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">🕐 Recent Applications</h2>
            <button
              onClick={() => navigate('/applications')}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </button>
          </div>
          {recentApps.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recent applications</div>
          ) : (
            <div className="space-y-2">
              {recentApps.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => navigate(`/application/${app.id}`)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{app.application_number}</div>
                    <div className="text-sm text-gray-600">{app.customer_name}</div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="font-semibold text-gray-900">
                      ${Number(app.requested_amount).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(app.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    app.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                    app.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                    app.status === 'approved' ? 'bg-green-100 text-green-800' :
                    app.status === 'declined' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">⚡ Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/queue?status=submitted')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
          >
            <div className="text-2xl mb-2">📥</div>
            <div className="font-medium text-gray-900">New Applications</div>
          </button>
          <button
            onClick={() => navigate('/queue?status=on_hold')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-yellow-500 hover:bg-yellow-50 transition-all text-left"
          >
            <div className="text-2xl mb-2">⏸️</div>
            <div className="font-medium text-gray-900">On Hold</div>
          </button>
          <button
            onClick={() => navigate('/queue?priority=high')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition-all text-left"
          >
            <div className="text-2xl mb-2">🔥</div>
            <div className="font-medium text-gray-900">High Priority</div>
          </button>
          <button
            onClick={() => navigate('/applications')}
            className="p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-medium text-gray-900">All Applications</div>
          </button>
        </div>
      </div>
    </div>
  )
}
