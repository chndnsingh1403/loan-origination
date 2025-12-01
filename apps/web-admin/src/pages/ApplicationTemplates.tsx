import React from 'react'
import { authenticatedFetch } from '../utils/auth'

type Template = { 
  id: string; 
  name: string; 
  description: string; 
  status: string; 
  steps: number; 
  products: number; 
  created: string;
  version?: number;
  form_schema?: any;
  validation_rules?: any;
  created_at?: string;
  updated_at?: string;
}

export const ApplicationTemplates: React.FC = () => {
  const [items, setItems] = React.useState<Template[]>([])
  const [q, setQ] = React.useState('')
  const [status, setStatus] = React.useState('All Templates')
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = React.useState(false)

  React.useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await authenticatedFetch('/api/templates')
        
        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.status}`)
        }
        
        const data = await response.json()
        
        // Transform the data to match the expected format
        const transformedItems = (data.items || data || []).map((item: any) => ({
          id: item.id,
          name: item.name || 'Untitled Template',
          description: item.description || 'No description available',
          status: 'Active', 
          steps: item.form_schema?.properties ? Object.keys(item.form_schema.properties).length : 0,
          products: 1, // Each template is associated with one product
          created: item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown',
          version: item.version,
          form_schema: item.form_schema,
          validation_rules: item.validation_rules
        }))
        
        // Filter by search query and status
        const filteredItems = transformedItems.filter(item => {
          const matchesSearch = !q || item.name.toLowerCase().includes(q.toLowerCase()) || 
                               item.description.toLowerCase().includes(q.toLowerCase())
          const matchesStatus = status === 'All Templates' || item.status === status
          return matchesSearch && matchesStatus
        })
        
        setItems(filteredItems)
      } catch (err: any) {
        console.error('Error fetching templates:', err)
        setError(err.message || 'Failed to fetch templates')
        setItems([])
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [q, status])

  const handleCreateTemplate = () => {
    setShowCreateModal(true)
  }

  const handleEditTemplate = (templateId: string) => {
    // TODO: Navigate to template editor
    alert(`Edit template: ${templateId}`)
  }

  const handleConfigureTemplate = (templateId: string) => {
    // TODO: Navigate to template configuration
    alert(`Configure template: ${templateId}`)
  }

  const handleDeactivateTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to deactivate this template?')) {
      try {
        const response = await authenticatedFetch(`/api/templates/${templateId}`, {
          method: 'DELETE'
        })
        if (response.ok) {
          // Refresh the list
          window.location.reload()
        } else {
          alert('Failed to deactivate template')
        }
      } catch (error) {
        console.error('Error deactivating template:', error)
        alert('Failed to deactivate template')
      }
    }
  }
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-lg font-semibold">Application Templates</div>
          <div className="text-sm text-gray-500">Manage application form templates</div>
        </div>
        <button 
          onClick={handleCreateTemplate}
          className="btn btn-primary"
        >
          + Add Template
        </button>
      </div>
      
      <div className="card p-4">
        <div className="font-medium mb-3">Filters</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input 
            className="input" 
            placeholder="Search by name or description..." 
            value={q} 
            onChange={e => setQ(e.target.value)} 
          />
          <select 
            className="select" 
            value={status} 
            onChange={e => setStatus(e.target.value)}
          >
            <option>All Templates</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b font-medium">
          Templates ({loading ? '...' : items.length})
        </div>
        
        {loading && (
          <div className="p-8 text-center text-gray-500">
            <div>Loading templates...</div>
          </div>
        )}
        
        {error && (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-2">Error loading templates</div>
            <div className="text-sm text-gray-500">{error}</div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 btn btn-primary"
            >
              Retry
            </button>
          </div>
        )}
        
        {!loading && !error && (
          <div className="divide-y">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="mb-2">No templates found</div>
                <div className="text-sm mb-4">Create your first application template to get started</div>
                <button 
                  onClick={handleCreateTemplate}
                  className="btn btn-primary"
                >
                  Create Template
                </button>
              </div>
            ) : (
              items.map(t => (
                <div key={t.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-sm text-gray-500">{t.description}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Version {t.version} • Created {t.created}
                    </div>
                  </div>
                  <div className="w-20 text-center">
                    <span className="badge badge-success">{t.status}</span>
                  </div>
                  <div className="w-16 text-sm text-gray-600 text-center">
                    {t.steps} fields
                  </div>
                  <div className="w-16 text-sm text-gray-600 text-center">
                    {t.products} product{t.products !== 1 ? 's' : ''}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleConfigureTemplate(t.id)}
                      className="btn btn-ghost text-sm"
                    >
                      Configure
                    </button>
                    <button 
                      onClick={() => handleEditTemplate(t.id)}
                      className="btn btn-ghost text-sm"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeactivateTemplate(t.id)}
                      className="btn btn-ghost text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create New Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name</label>
                <input type="text" className="input" placeholder="Enter template name" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input" rows={3} placeholder="Enter template description"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Product</label>
                <select className="select">
                  <option>Select a loan product</option>
                  <option>Personal Loan</option>
                  <option>Mortgage</option>
                  <option>Auto Loan</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="btn flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // TODO: Implement create template
                  alert('Template creation not implemented yet')
                  setShowCreateModal(false)
                }}
                className="btn btn-primary flex-1"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
