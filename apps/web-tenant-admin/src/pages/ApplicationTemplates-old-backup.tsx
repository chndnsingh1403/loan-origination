import React, { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Copy, FileText, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { authenticatedFetch } from '../utils/auth'

interface LoanProduct {
  id: string
  name: string
  code: string
}

interface FieldDefinition {
  id: string
  name: string
  label: string
  type: 'text' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'textarea' | 'currency' | 'percentage'
  required: boolean
  options?: string[]
  validation?: any
  placeholder?: string
  helpText?: string
}

interface Stage {
  id: string
  name: string
  order: number
  fields: FieldDefinition[]
}

interface Template {
  id: string
  name: string
  loan_product_id: string
  loan_product_name?: string
  stages: Stage[]
  version: number
  is_active: boolean
  created_at: string
}

// Default field templates for loan origination
const DEFAULT_FIELD_TEMPLATES: Record<string, FieldDefinition[]> = {
  'Personal Information': [
    { id: 'first_name', name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: 'John' },
    { id: 'last_name', name: 'last_name', label: 'Last Name', type: 'text', required: true, placeholder: 'Doe' },
    { id: 'email', name: 'email', label: 'Email Address', type: 'email', required: true, placeholder: 'john.doe@example.com' },
    { id: 'phone', name: 'phone', label: 'Phone Number', type: 'phone', required: true, placeholder: '(555) 123-4567' },
    { id: 'dob', name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
    { id: 'ssn', name: 'ssn', label: 'Social Security Number', type: 'text', required: true, placeholder: 'XXX-XX-XXXX' },
    { id: 'address', name: 'address', label: 'Street Address', type: 'text', required: true },
    { id: 'city', name: 'city', label: 'City', type: 'text', required: true },
    { id: 'state', name: 'state', label: 'State', type: 'select', required: true, options: ['CA', 'NY', 'TX', 'FL', 'IL'] },
    { id: 'zip', name: 'zip_code', label: 'ZIP Code', type: 'text', required: true, placeholder: '12345' },
  ],
  'Income Information': [
    { id: 'employment_status', name: 'employment_status', label: 'Employment Status', type: 'select', required: true, options: ['Employed', 'Self-Employed', 'Retired', 'Unemployed'] },
    { id: 'employer_name', name: 'employer_name', label: 'Employer Name', type: 'text', required: false },
    { id: 'job_title', name: 'job_title', label: 'Job Title', type: 'text', required: false },
    { id: 'annual_income', name: 'annual_income', label: 'Annual Income', type: 'currency', required: true, placeholder: '50000' },
    { id: 'other_income', name: 'other_income', label: 'Other Income', type: 'currency', required: false, placeholder: '0' },
    { id: 'employment_length', name: 'employment_length', label: 'Years at Current Job', type: 'number', required: false },
  ],
  'Liabilities': [
    { id: 'monthly_mortgage', name: 'monthly_mortgage', label: 'Monthly Mortgage/Rent', type: 'currency', required: true, placeholder: '1500' },
    { id: 'monthly_car_payment', name: 'monthly_car_payment', label: 'Monthly Car Payment', type: 'currency', required: false, placeholder: '0' },
    { id: 'credit_card_debt', name: 'credit_card_debt', label: 'Total Credit Card Debt', type: 'currency', required: false, placeholder: '0' },
    { id: 'student_loans', name: 'student_loans', label: 'Student Loan Balance', type: 'currency', required: false, placeholder: '0' },
    { id: 'other_debts', name: 'other_debts', label: 'Other Monthly Debts', type: 'currency', required: false, placeholder: '0' },
  ],
  'Loan Details': [
    { id: 'loan_amount', name: 'loan_amount', label: 'Requested Loan Amount', type: 'currency', required: true, placeholder: '25000' },
    { id: 'loan_purpose', name: 'loan_purpose', label: 'Loan Purpose', type: 'select', required: true, options: ['Home Purchase', 'Refinance', 'Debt Consolidation', 'Business', 'Other'] },
    { id: 'loan_term', name: 'loan_term', label: 'Preferred Loan Term (months)', type: 'number', required: true, placeholder: '60' },
    { id: 'down_payment', name: 'down_payment', label: 'Down Payment', type: 'currency', required: false, placeholder: '5000' },
    { id: 'property_value', name: 'property_value', label: 'Property Value', type: 'currency', required: false, placeholder: '200000' },
  ],
  'Assets': [
    { id: 'checking_balance', name: 'checking_balance', label: 'Checking Account Balance', type: 'currency', required: false, placeholder: '5000' },
    { id: 'savings_balance', name: 'savings_balance', label: 'Savings Account Balance', type: 'currency', required: false, placeholder: '10000' },
    { id: 'investment_balance', name: 'investment_balance', label: 'Investment Account Balance', type: 'currency', required: false, placeholder: '50000' },
    { id: 'retirement_balance', name: 'retirement_balance', label: 'Retirement Account Balance', type: 'currency', required: false, placeholder: '100000' },
  ],
}

const AVAILABLE_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
]

export const ApplicationTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [templateName, setTemplateName] = useState('')
  const [stages, setStages] = useState<Stage[]>([])
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [templatesRes, productsRes] = await Promise.all([
        authenticatedFetch('/api/templates'),
        authenticatedFetch('/api/loan-products'),
      ])

      if (templatesRes.ok) {
        const data = await templatesRes.json()
        console.log('Templates data:', data)
        setTemplates(Array.isArray(data) ? data : (data.items || []))
      }

      if (productsRes.ok) {
        const data = await productsRes.json()
        console.log('Products data:', data, 'isArray:', Array.isArray(data))
        const products = Array.isArray(data) ? data : (data.items || [])
        console.log('Setting loan products:', products)
        setLoanProducts(products)
      } else {
        console.error('Products fetch failed:', productsRes.status, productsRes.statusText)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = () => {
    setEditingTemplate(null)
    setSelectedProduct('')
    setTemplateName('')
    setStages([
      {
        id: crypto.randomUUID(),
        name: 'Personal Information',
        order: 1,
        fields: [...DEFAULT_FIELD_TEMPLATES['Personal Information']],
      },
      {
        id: crypto.randomUUID(),
        name: 'Income Information',
        order: 2,
        fields: [...DEFAULT_FIELD_TEMPLATES['Income Information']],
      },
      {
        id: crypto.randomUUID(),
        name: 'Liabilities',
        order: 3,
        fields: [...DEFAULT_FIELD_TEMPLATES['Liabilities']],
      },
      {
        id: crypto.randomUUID(),
        name: 'Loan Details',
        order: 4,
        fields: [...DEFAULT_FIELD_TEMPLATES['Loan Details']],
      },
    ])
    setShowModal(true)
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setSelectedProduct(template.loan_product_id)
    setTemplateName(template.name)
    setStages(template.stages || [])
    setShowModal(true)
  }

  const handleAddStage = () => {
    const newStage: Stage = {
      id: crypto.randomUUID(),
      name: 'New Stage',
      order: stages.length + 1,
      fields: [],
    }
    setStages([...stages, newStage])
  }

  const handleRemoveStage = (stageId: string) => {
    if (confirm('Are you sure you want to remove this stage?')) {
      setStages(stages.filter(s => s.id !== stageId))
    }
  }

  const handleAddField = (stageId: string) => {
    setEditingStageId(stageId)
    setEditingField({
      id: crypto.randomUUID(),
      name: '',
      label: '',
      type: 'text',
      required: false,
    })
    setShowFieldModal(true)
  }

  const handleEditField = (stageId: string, field: FieldDefinition) => {
    setEditingStageId(stageId)
    setEditingField(field)
    setShowFieldModal(true)
  }

  const handleSaveField = () => {
    if (!editingField || !editingStageId) return

    setStages(stages.map(stage => {
      if (stage.id === editingStageId) {
        const existingIndex = stage.fields.findIndex(f => f.id === editingField.id)
        if (existingIndex >= 0) {
          // Update existing field
          const newFields = [...stage.fields]
          newFields[existingIndex] = editingField
          return { ...stage, fields: newFields }
        } else {
          // Add new field
          return { ...stage, fields: [...stage.fields, editingField] }
        }
      }
      return stage
    }))

    setShowFieldModal(false)
    setEditingField(null)
    setEditingStageId(null)
  }

  const handleRemoveField = (stageId: string, fieldId: string) => {
    if (confirm('Are you sure you want to remove this field?')) {
      setStages(stages.map(stage => {
        if (stage.id === stageId) {
          return { ...stage, fields: stage.fields.filter(f => f.id !== fieldId) }
        }
        return stage
      }))
    }
  }

  const handleSaveTemplate = async () => {
    if (!selectedProduct || !templateName || stages.length === 0) {
      alert('Please select a product, enter a name, and add at least one stage')
      return
    }

    try {
      const payload = {
        loan_product_id: selectedProduct,
        name: templateName,
        form_schema: { stages },
        validation_rules: {},
      }

      const url = editingTemplate ? `/api/templates/${editingTemplate.id}` : '/api/templates'
      const method = editingTemplate ? 'PUT' : 'POST'

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        await fetchData()
        setShowModal(false)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Failed to save template')
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        const response = await authenticatedFetch(`/api/templates/${id}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          await fetchData()
        }
      } catch (error) {
        console.error('Error deleting template:', error)
      }
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Application Templates</h1>
          <p className="text-gray-600">Configure multi-stage application forms for each loan product</p>
        </div>
        <button onClick={handleCreateTemplate} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Create Template
        </button>
      </div>

      {/* Templates List */}
      <div className="card">
        <div className="p-4 border-b font-medium">Templates ({templates.length})</div>
        <div className="divide-y">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No templates yet. Create your first application template.</p>
            </div>
          ) : (
            templates.map(template => (
              <div key={template.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{template.name}</div>
                  <div className="text-sm text-gray-500">
                    Product: {template.loan_product_name || 'Unknown'} • {template.stages?.length || 0} stages • Version {template.version}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEditTemplate(template)} className="btn btn-sm flex items-center gap-1">
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={() => handleDeleteTemplate(template.id)} className="btn btn-sm btn-danger flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Template Editor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </h2>

            {/* Basic Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Personal Loan Application"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Loan Product *</label>
                <select
                  className="input w-full"
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                >
                  <option value="">Select a product...</option>
                  {loanProducts.map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stages */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Application Stages</h3>
                <button onClick={handleAddStage} className="btn btn-sm flex items-center gap-1">
                  <Plus size={14} /> Add Stage
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div key={stage.id} className="border rounded-lg">
                    <div 
                      className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical size={16} className="text-gray-400" />
                        <span className="font-medium">Stage {index + 1}: {stage.name}</span>
                        <span className="text-sm text-gray-500">({stage.fields.length} fields)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveStage(stage.id)
                          }}
                          className="btn btn-sm btn-danger"
                        >
                          <Trash2 size={14} />
                        </button>
                        {expandedStage === stage.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {expandedStage === stage.id && (
                      <div className="p-4 space-y-3">
                        <div>
                          <input
                            type="text"
                            className="input w-full"
                            value={stage.name}
                            onChange={(e) => {
                              setStages(stages.map(s => s.id === stage.id ? { ...s, name: e.target.value } : s))
                            }}
                            placeholder="Stage name"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Fields</span>
                            <button
                              onClick={() => handleAddField(stage.id)}
                              className="btn btn-sm flex items-center gap-1"
                            >
                              <Plus size={12} /> Add Field
                            </button>
                          </div>

                          <div className="space-y-2">
                            {stage.fields.map(field => (
                              <div key={field.id} className="p-2 bg-gray-50 rounded flex items-center justify-between">
                                <div>
                                  <span className="font-medium text-sm">{field.label}</span>
                                  <span className="text-xs text-gray-500 ml-2">({field.type})</span>
                                  {field.required && <span className="text-xs text-red-600 ml-2">*required</span>}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleEditField(stage.id, field)}
                                    className="btn btn-sm"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveField(stage.id, field.id)}
                                    className="btn btn-sm btn-danger"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="btn">Cancel</button>
              <button onClick={handleSaveTemplate} className="btn btn-primary">
                {editingTemplate ? 'Update Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Editor Modal */}
      {showFieldModal && editingField && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              {editingField.name ? 'Edit Field' : 'Add Field'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Field Label *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingField.label}
                  onChange={(e) => setEditingField({ ...editingField, label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., First Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Field Type *</label>
                <select
                  className="input w-full"
                  value={editingField.type}
                  onChange={(e) => setEditingField({ ...editingField, type: e.target.value as any })}
                >
                  {AVAILABLE_FIELD_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Placeholder</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingField.placeholder || ''}
                  onChange={(e) => setEditingField({ ...editingField, placeholder: e.target.value })}
                  placeholder="e.g., Enter your first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Help Text</label>
                <input
                  type="text"
                  className="input w-full"
                  value={editingField.helpText || ''}
                  onChange={(e) => setEditingField({ ...editingField, helpText: e.target.value })}
                  placeholder="Additional help or instructions"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={editingField.required}
                  onChange={(e) => setEditingField({ ...editingField, required: e.target.checked })}
                />
                <label htmlFor="required" className="text-sm">Required field</label>
              </div>

              {editingField.type === 'select' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Options (one per line)</label>
                  <textarea
                    className="input w-full"
                    rows={4}
                    value={editingField.options?.join('\n') || ''}
                    onChange={(e) => setEditingField({ ...editingField, options: e.target.value.split('\n').filter(o => o.trim()) })}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowFieldModal(false)} className="btn">Cancel</button>
              <button onClick={handleSaveField} className="btn btn-primary">
                Save Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
