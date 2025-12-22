import React from 'react'
import { authenticatedFetch } from '../utils/auth'
import { useNavigate } from 'react-router-dom'

type Application = {
  id: string
  application_number: string
  customer: string
  product: string
  status: string
  stage: string
  requested_amount: number
  requested_term_months: number
  purpose: string
  broker: string
  created: string
  submitted_at: string | null
  applicant_data: Record<string, any>
}

type ColumnConfig = {
  key: string
  label: string
  visible: boolean
  width?: string
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'application_number', label: 'App #', visible: true, width: '140px' },
  { key: 'customer', label: 'Customer Name', visible: true },
  { key: 'email', label: 'Email', visible: true },
  { key: 'phone', label: 'Phone', visible: true },
  { key: 'requested_amount', label: 'Loan Amount', visible: true, width: '120px' },
  { key: 'requested_term_months', label: 'Term (mo)', visible: true, width: '100px' },
  { key: 'purpose', label: 'Purpose', visible: true },
  { key: 'annual_income', label: 'Annual Income', visible: false },
  { key: 'employment_status', label: 'Employment', visible: false },
  { key: 'status', label: 'Status', visible: true, width: '120px' },
  { key: 'created', label: 'Created', visible: true, width: '110px' },
]

export const Applications: React.FC = () => {
  const navigate = useNavigate()
  const [items, setItems] = React.useState<Application[]>([])
  const [columns, setColumns] = React.useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('broker_app_columns')
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS
  })
  const [showColumnConfig, setShowColumnConfig] = React.useState(false)
  const [editingApp, setEditingApp] = React.useState<Application | null>(null)

  React.useEffect(() => {
    fetchApps()
  }, [])

  const fetchApps = async () => {
    try {
      const response = await authenticatedFetch('/api/broker/applications')
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching applications:', error)
      setItems([])
    }
  }

  const submitApplication = async (appId: string) => {
    if (!confirm('Submit this application for underwriting review?')) return
    
    try {
      const response = await authenticatedFetch(`/api/broker/applications/${appId}/submit`, {
        method: 'POST'
      })
      
      if (response.ok) {
        alert('Application submitted successfully!')
        fetchApps()
      } else {
        const error = await response.json()
        alert('Error: ' + (error.error || 'Failed to submit application'))
      }
    } catch (error) {
      console.error('Error submitting application:', error)
      alert('Failed to submit application')
    }
  }

  const toggleColumn = (key: string) => {
    const updated = columns.map(col =>
      col.key === key ? { ...col, visible: !col.visible } : col
    )
    setColumns(updated)
    localStorage.setItem('broker_app_columns', JSON.stringify(updated))
  }

  const getCellValue = (app: Application, key: string) => {
    if (key === 'customer') return app.customer
    if (key === 'email') return app.applicant_data?.email || '-'
    if (key === 'phone') return app.applicant_data?.phone || '-'
    if (key === 'annual_income') return app.applicant_data?.annual_income ? `$${Number(app.applicant_data.annual_income).toLocaleString()}` : '-'
    if (key === 'employment_status') return app.applicant_data?.employment_status || '-'
    if (key === 'requested_amount') return `$${Number(app.requested_amount || 0).toLocaleString()}`
    if (key === 'requested_term_months') return app.requested_term_months || '-'
    if (key === 'purpose') return app.purpose || '-'
    if (key === 'status') return app.status
    if (key === 'created') return app.created
    if (key === 'application_number') return app.application_number
    return '-'
  }

  const visibleColumns = columns.filter(c => c.visible)

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Applications ({items.length})
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowColumnConfig(!showColumnConfig)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Columns
          </button>
          <button
            onClick={() => navigate('/new-application')}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
          >
            + New Application
          </button>
        </div>
      </div>

      {showColumnConfig && (
        <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
          <div className="font-semibold mb-3 text-gray-700">Configure Columns</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {columns.map(col => (
              <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                <input
                  type="checkbox"
                  checked={col.visible}
                  onChange={() => toggleColumn(col.key)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{col.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-4">No applications yet</p>
          <button
            onClick={() => navigate('/new-application')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Your First Application
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  {visibleColumns.map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                      style={{ width: col.width }}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider" style={{ width: '100px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map(app => (
                  <tr 
                    key={app.id} 
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/applications/${app.id}`)}
                  >
                    {visibleColumns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-900">
                        {col.key === 'status' ? (
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            app.status === 'approved' ? 'bg-green-100 text-green-800' :
                            app.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            app.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                            app.status === 'declined' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {app.status}
                          </span>
                        ) : (
                          getCellValue(app, col.key)
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingApp(app);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        {app.status === 'draft' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              submitApplication(app.id);
                            }}
                            className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700"
                          >
                            Submit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Edit Application</h2>
                  <p className="text-blue-100 mt-1">{editingApp.application_number}</p>
                </div>
                <button
                  onClick={() => setEditingApp(null)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    defaultValue={editingApp.applicant_data?.first_name}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    defaultValue={editingApp.applicant_data?.last_name}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    defaultValue={editingApp.applicant_data?.email}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    defaultValue={editingApp.applicant_data?.phone}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Loan Amount</label>
                  <input
                    type="number"
                    defaultValue={editingApp.requested_amount}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Term (months)</label>
                  <input
                    type="number"
                    defaultValue={editingApp.requested_term_months}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose</label>
                  <input
                    type="text"
                    defaultValue={editingApp.purpose}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Annual Income</label>
                  <input
                    type="text"
                    defaultValue={editingApp.applicant_data?.annual_income}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Employment Status</label>
                  <select
                    defaultValue={editingApp.applicant_data?.employment_status}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Employed">Employed</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Retired">Retired</option>
                    <option value="Unemployed">Unemployed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setEditingApp(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Update functionality will be implemented')
                    setEditingApp(null)
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
