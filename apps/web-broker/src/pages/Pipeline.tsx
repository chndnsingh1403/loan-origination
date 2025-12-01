import React, { useState, useEffect } from 'react'
import { authenticatedFetch } from '../utils/auth'

type PipelineStats = {
  total_applications: number
  pending: number
  under_review: number
  approved: number
  funded: number
  declined: number
  total_amount: number
  avg_approval_time: number
}

type RecentActivity = {
  id: string
  type: string
  description: string
  timestamp: string
}

export const Pipeline: React.FC = () => {
  const [stats, setStats] = useState<PipelineStats | null>(null)
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activitiesRes] = await Promise.all([
          authenticatedFetch('/api/broker/pipeline/stats'),
          authenticatedFetch('/api/broker/pipeline/activities')
        ])
        
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data)
        }
        
        if (activitiesRes.ok) {
          const data = await activitiesRes.json()
          setActivities(data.items || [])
        }
      } catch (error) {
        console.error('Error fetching pipeline data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  const statCards = [
    { label: 'Total Applications', value: stats?.total_applications || 0, color: 'bg-blue-500' },
    { label: 'Pending Review', value: stats?.pending || 0, color: 'bg-yellow-500' },
    { label: 'Under Review', value: stats?.under_review || 0, color: 'bg-orange-500' },
    { label: 'Approved', value: stats?.approved || 0, color: 'bg-green-500' },
    { label: 'Funded', value: stats?.funded || 0, color: 'bg-emerald-600' },
    { label: 'Declined', value: stats?.declined || 0, color: 'bg-red-500' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pipeline Dashboard</h1>
        <p className="text-gray-600">Overview of your loan applications</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg shadow p-4">
            <div className={`w-12 h-12 ${stat.color} rounded-lg flex items-center justify-center text-white text-xl font-bold mb-3`}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Total Pipeline Value</h3>
          <div className="text-3xl font-bold text-blue-600">
            ${((stats?.total_amount || 0) / 1000).toFixed(0)}K
          </div>
          <p className="text-sm text-gray-500 mt-1">Across all applications</p>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Avg. Approval Time</h3>
          <div className="text-3xl font-bold text-green-600">
            {stats?.avg_approval_time || 0} days
          </div>
          <p className="text-sm text-gray-500 mt-1">From submission to decision</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {activities.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent activity
            </div>
          ) : (
            activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="px-6 py-4 flex items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(activity.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
