import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticatedFetch } from '../utils/auth'
import { CheckCircle, Clock, AlertCircle, PlayCircle } from 'lucide-react'

type Task = {
  id: string
  name: string
  description: string
  task_type: string
  assigned_role: string
  status: string
  sequence_order: number
  is_required: boolean
  application_id: string
  application_number: string
  application_status: string
  requested_amount: number
  applicant_data: any
  product_name: string
  product_type: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export const Tasks: React.FC = () => {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [stats, setStats] = useState({ total: 0, pending: 0, in_progress: 0, completed: 0 })

  useEffect(() => {
    fetchTasks()
  }, [statusFilter])

  const fetchTasks = async () => {
    try {
      const url = new URL('/api/underwriter/tasks', window.location.origin)
      if (statusFilter !== 'all') {
        url.searchParams.set('status', statusFilter)
      }
      
      const response = await authenticatedFetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        setTasks(data || [])
        
        // Calculate stats from the data
        const allTasksResponse = await authenticatedFetch('/api/underwriter/tasks')
        if (allTasksResponse.ok) {
          const allTasks = await allTasksResponse.json()
          setStats({
            total: allTasks.length,
            pending: allTasks.filter((t: Task) => t.status === 'pending').length,
            in_progress: allTasks.filter((t: Task) => t.status === 'in_progress').length,
            completed: allTasks.filter((t: Task) => t.status === 'completed').length
          })
        }
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const response = await authenticatedFetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        fetchTasks() // Refresh the list
      }
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'in_progress':
        return <PlayCircle className="w-5 h-5 text-blue-600" />
      case 'blocked':
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      case 'skipped': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCustomerName = (applicant_data: any) => {
    if (!applicant_data) return 'Unknown'
    return `${applicant_data.first_name || ''} ${applicant_data.last_name || ''}`.trim() || 'Unknown'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="text-gray-500">Loading tasks...</div></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <button
          onClick={fetchTasks}
          className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-gray-500">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Tasks</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
          <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
          <div className="text-2xl font-bold text-gray-900">{stats.in_progress}</div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
          <div className="text-2xl font-bold text-gray-900">{stats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Tasks</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            No tasks found with status: {statusFilter}
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(task.status)}
                    <h3 className="text-lg font-semibold text-gray-900">{task.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.is_required && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Required
                      </span>
                    )}
                  </div>
                  
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Application:</span>
                      <p className="font-medium text-blue-600 cursor-pointer hover:underline"
                         onClick={() => navigate(`/application/${task.application_id}`)}>
                        {task.application_number}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Customer:</span>
                      <p className="font-medium text-gray-900">{getCustomerName(task.applicant_data)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Product:</span>
                      <p className="font-medium text-gray-900">{task.product_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Amount:</span>
                      <p className="font-medium text-gray-900">${Number(task.requested_amount).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Start Task
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'completed')}
                        className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Complete
                      </button>
                      <button
                        onClick={() => updateTaskStatus(task.id, 'blocked')}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Block
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/application/${task.application_id}`)}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    View App
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
