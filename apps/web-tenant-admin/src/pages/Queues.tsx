import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Users, X } from 'lucide-react'
import { authenticatedFetch } from '../utils/auth'

interface User {
  id: number
  username: string
  email: string
  full_name: string
  role: string
}

interface Queue {
  id: number
  name: string
  description: string
  queue_type: 'underwriting' | 'processing' | 'approval' | 'review'
  is_active: boolean
  max_capacity: number
  priority_level: number
  created_at: string
  updated_at: string
  assigned_users?: User[]
}

interface QueueFormData {
  name: string
  description: string
  queue_type: 'underwriting' | 'processing' | 'approval' | 'review'
  is_active: boolean
  max_capacity: number
  priority_level: number
}

export const Queues: React.FC = () => {
  const [queues, setQueues] = useState<Queue[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQueue, setEditingQueue] = useState<Queue | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Queue | null>(null)
  const [manageUsersQueue, setManageUsersQueue] = useState<Queue | null>(null)

  const [formData, setFormData] = useState<QueueFormData>({
    name: '',
    description: '',
    queue_type: 'underwriting',
    is_active: true,
    max_capacity: 50,
    priority_level: 5
  })

  useEffect(() => {
    fetchQueues()
    fetchUsers()
  }, [])

  const fetchQueues = async () => {
    try {
      setLoading(true)
      const data = await authenticatedFetch('/api/queues')
      setQueues(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch queues')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const data = await authenticatedFetch('/api/users')
      // Filter for underwriters and processors only
      const eligibleUsers = data.filter((u: User) => 
        ['underwriter', 'processor'].includes(u.role)
      )
      setUsers(eligibleUsers)
    } catch (err: any) {
      console.error('Failed to fetch users:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingQueue) {
        await authenticatedFetch(`/api/queues/${editingQueue.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        })
      } else {
        await authenticatedFetch('/api/queues', {
          method: 'POST',
          body: JSON.stringify(formData)
        })
      }
      
      await fetchQueues()
      closeModal()
    } catch (err: any) {
      setError(err.message || 'Failed to save queue')
    }
  }

  const handleDelete = async (queue: Queue) => {
    try {
      await authenticatedFetch(`/api/queues/${queue.id}`, {
        method: 'DELETE'
      })
      await fetchQueues()
      setDeleteConfirm(null)
    } catch (err: any) {
      setError(err.message || 'Failed to delete queue')
    }
  }

  const handleAssignUser = async (queueId: number, userId: number) => {
    try {
      await authenticatedFetch(`/api/queues/${queueId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId })
      })
      await fetchQueues()
    } catch (err: any) {
      setError(err.message || 'Failed to assign user')
    }
  }

  const handleUnassignUser = async (queueId: number, userId: number) => {
    try {
      await authenticatedFetch(`/api/queues/${queueId}/unassign/${userId}`, {
        method: 'DELETE'
      })
      await fetchQueues()
    } catch (err: any) {
      setError(err.message || 'Failed to unassign user')
    }
  }

  const openCreateModal = () => {
    setEditingQueue(null)
    setFormData({
      name: '',
      description: '',
      queue_type: 'underwriting',
      is_active: true,
      max_capacity: 50,
      priority_level: 5
    })
    setIsModalOpen(true)
  }

  const openEditModal = (queue: Queue) => {
    setEditingQueue(queue)
    setFormData({
      name: queue.name,
      description: queue.description,
      queue_type: queue.queue_type,
      is_active: queue.is_active,
      max_capacity: queue.max_capacity,
      priority_level: queue.priority_level
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingQueue(null)
  }

  const getQueueTypeColor = (type: string) => {
    switch (type) {
      case 'underwriting': return 'bg-blue-100 text-blue-800'
      case 'processing': return 'bg-green-100 text-green-800'
      case 'approval': return 'bg-purple-100 text-purple-800'
      case 'review': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="p-6">Loading queues...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
          <p className="text-gray-600">Manage work queues and user assignments</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} />
          Create Queue
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {queues.map(queue => (
          <div key={queue.id} className="bg-white rounded-lg border p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold">{queue.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQueueTypeColor(queue.queue_type)}`}>
                    {queue.queue_type}
                  </span>
                  {!queue.is_active && (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Inactive
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    Priority: {queue.priority_level}
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{queue.description}</p>
                <div className="text-sm text-gray-500">
                  Max Capacity: {queue.max_capacity} • Assigned Users: {queue.assigned_users?.length || 0}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setManageUsersQueue(queue)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Manage Users"
                >
                  <Users size={18} />
                </button>
                <button
                  onClick={() => openEditModal(queue)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => setDeleteConfirm(queue)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {queue.assigned_users && queue.assigned_users.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Assigned Users:</div>
                <div className="flex flex-wrap gap-2">
                  {queue.assigned_users.map(user => (
                    <div key={user.id} className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-sm">
                      <span>{user.full_name}</span>
                      <span className="text-gray-500">({user.role})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {queues.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No queues found. Create one to get started.
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingQueue ? 'Edit Queue' : 'Create New Queue'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Queue Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., Primary Underwriting Queue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Describe the purpose of this queue..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Queue Type *
                  </label>
                  <select
                    required
                    value={formData.queue_type}
                    onChange={e => setFormData({...formData, queue_type: e.target.value as any})}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="underwriting">Underwriting</option>
                    <option value="processing">Processing</option>
                    <option value="approval">Approval</option>
                    <option value="review">Review</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Capacity *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="1000"
                    value={formData.max_capacity}
                    onChange={e => setFormData({...formData, max_capacity: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority Level (1-10) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="10"
                    value={formData.priority_level}
                    onChange={e => setFormData({...formData, priority_level: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Higher = More Priority</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({...formData, is_active: e.target.checked})}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingQueue ? 'Update Queue' : 'Create Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Delete Queue</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Users Modal */}
      {manageUsersQueue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Manage Users - {manageUsersQueue.name}</h2>
              <button
                onClick={() => setManageUsersQueue(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Assigned Users</h3>
              {manageUsersQueue.assigned_users && manageUsersQueue.assigned_users.length > 0 ? (
                <div className="space-y-2">
                  {manageUsersQueue.assigned_users.map(user => (
                    <div key={user.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-gray-600">{user.email} • {user.role}</div>
                      </div>
                      <button
                        onClick={() => handleUnassignUser(manageUsersQueue.id, user.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No users assigned yet</p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Available Users</h3>
              {users.filter(u => !manageUsersQueue.assigned_users?.some(au => au.id === u.id)).length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {users
                    .filter(u => !manageUsersQueue.assigned_users?.some(au => au.id === u.id))
                    .map(user => (
                      <div key={user.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-sm text-gray-600">{user.email} • {user.role}</div>
                        </div>
                        <button
                          onClick={() => handleAssignUser(manageUsersQueue.id, user.id)}
                          className="px-3 py-1 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">All eligible users are already assigned</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-6">
              <button
                onClick={() => setManageUsersQueue(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
