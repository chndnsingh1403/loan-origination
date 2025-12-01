import React, { useState, useEffect } from 'react'
import { authenticatedFetch } from '../utils/auth'

interface LoanProduct {
  id: string
  name: string
  type: string
  description?: string
  is_active?: boolean
}

interface FormField {
  id: string
  name: string
  label: string
  type: 'text' | 'number' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'checkbox' | 'file'
  required: boolean
  placeholder?: string
  options?: string[] // For select fields
  validation?: {
    min?: number
    max?: number
    pattern?: string
    minLength?: number
    maxLength?: number
  }
}

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'basic' | 'fields'>('basic')
  const [loading, setLoading] = useState(false)
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  
  // Basic template info
  const [templateName, setTemplateName] = useState('')
  const [description, setDescription] = useState('')
  const [loanProductId, setLoanProductId] = useState('')
  
  // Form fields
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [editingField, setEditingField] = useState<FormField | null>(null)
  
  // Field being added/edited
  const [fieldName, setFieldName] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<FormField['type']>('text')
  const [fieldRequired, setFieldRequired] = useState(false)
  const [fieldPlaceholder, setFieldPlaceholder] = useState('')
  const [fieldOptions, setFieldOptions] = useState('')
  const [fieldMinLength, setFieldMinLength] = useState('')
  const [fieldMaxLength, setFieldMaxLength] = useState('')
  const [fieldPattern, setFieldPattern] = useState('')

  // Fetch loan products
  useEffect(() => {
    if (isOpen) {
      fetchLoanProducts()
    }
  }, [isOpen])

  const fetchLoanProducts = async () => {
    try {
      setLoadingProducts(true)
      const response = await authenticatedFetch('/api/loan-products')
      
      if (!response.ok) {
        throw new Error('Failed to fetch loan products')
      }
      
      const data = await response.json()
      console.log('Raw loan products response:', data)
      console.log('Is array?', Array.isArray(data))
      
      // API returns array directly, not wrapped in items
      const productsArray = Array.isArray(data) ? data : (data.items || [])
      console.log('Products array:', productsArray)
      console.log('Products count before dedup:', productsArray.length)
      
      // Filter out duplicates and only active products
      const uniqueProducts = productsArray
        .filter((product: LoanProduct) => product.is_active !== false)
        .reduce((acc: LoanProduct[], current: LoanProduct) => {
          const exists = acc.find(p => p.id === current.id)
          if (!exists) {
            acc.push(current)
          }
          return acc
        }, [])
      
      console.log('Unique products:', uniqueProducts)
      console.log('Unique products count:', uniqueProducts.length)
      
      setLoanProducts(uniqueProducts)
    } catch (error) {
      console.error('Error fetching loan products:', error)
      alert('Failed to load loan products. Please try again.')
    } finally {
      setLoadingProducts(false)
    }
  }

  const resetForm = () => {
    setStep('basic')
    setTemplateName('')
    setDescription('')
    setLoanProductId('')
    setFormFields([])
    setEditingField(null)
    resetFieldForm()
  }

  const resetFieldForm = () => {
    setFieldName('')
    setFieldLabel('')
    setFieldType('text')
    setFieldRequired(false)
    setFieldPlaceholder('')
    setFieldOptions('')
    setFieldMinLength('')
    setFieldMaxLength('')
    setFieldPattern('')
  }

  const handleAddField = () => {
    if (!fieldName || !fieldLabel) {
      alert('Field name and label are required')
      return
    }

    const newField: FormField = {
      id: Date.now().toString(),
      name: fieldName,
      label: fieldLabel,
      type: fieldType,
      required: fieldRequired,
      placeholder: fieldPlaceholder || undefined,
      options: fieldType === 'select' && fieldOptions ? fieldOptions.split(',').map(o => o.trim()) : undefined,
      validation: {
        minLength: fieldMinLength ? parseInt(fieldMinLength) : undefined,
        maxLength: fieldMaxLength ? parseInt(fieldMaxLength) : undefined,
        pattern: fieldPattern || undefined,
      }
    }

    if (editingField) {
      setFormFields(formFields.map(f => f.id === editingField.id ? newField : f))
      setEditingField(null)
    } else {
      setFormFields([...formFields, newField])
    }

    resetFieldForm()
  }

  const handleEditField = (field: FormField) => {
    setEditingField(field)
    setFieldName(field.name)
    setFieldLabel(field.label)
    setFieldType(field.type)
    setFieldRequired(field.required)
    setFieldPlaceholder(field.placeholder || '')
    setFieldOptions(field.options?.join(', ') || '')
    setFieldMinLength(field.validation?.minLength?.toString() || '')
    setFieldMaxLength(field.validation?.maxLength?.toString() || '')
    setFieldPattern(field.validation?.pattern || '')
  }

  const handleDeleteField = (fieldId: string) => {
    setFormFields(formFields.filter(f => f.id !== fieldId))
  }

  const handleSubmit = async () => {
    // Validation
    if (!templateName.trim()) {
      alert('Template name is required')
      return
    }

    if (formFields.length === 0) {
      alert('Please add at least one form field')
      return
    }

    try {
      setLoading(true)

      // Build JSON schema from form fields
      const formSchema = {
        type: 'object',
        properties: formFields.reduce((acc, field) => {
          acc[field.name] = {
            type: field.type === 'number' ? 'number' : 'string',
            title: field.label,
            ...(field.placeholder && { description: field.placeholder }),
            ...(field.type === 'select' && field.options && { enum: field.options }),
          }
          return acc
        }, {} as any),
        required: formFields.filter(f => f.required).map(f => f.name)
      }

      // Build validation rules
      const validation_rules = formFields.reduce((acc, field) => {
        if (field.validation && Object.keys(field.validation).length > 0) {
          acc[field.name] = field.validation
        }
        return acc
      }, {} as any)

      const templateData = {
        name: templateName,
        description,
        loan_product_id: loanProductId || null,
        form_schema: formSchema,
        validation_rules
      }

      console.log('Creating template:', templateData)

      const response = await authenticatedFetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create template')
      }

      const result = await response.json()
      console.log('Template created:', result)

      alert('Template created successfully!')
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating template:', error)
      alert(error instanceof Error ? error.message : 'Failed to create template')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h3 className="text-xl font-semibold">Create New Application Template</h3>
            <p className="text-sm text-gray-600 mt-1">
              {step === 'basic' ? 'Step 1: Basic Information' : 'Step 2: Form Fields'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'basic' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Standard Mortgage Application"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe this template..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Loan Product (Optional)</label>
                {loadingProducts ? (
                  <div className="text-sm text-gray-500">Loading products...</div>
                ) : (
                  <select
                    value={loanProductId}
                    onChange={(e) => setLoanProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select a loan product --</option>
                    {loanProducts.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name}{product.type ? ` (${product.type})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Form Fields List */}
              <div>
                <h4 className="font-medium mb-3">Template Fields ({formFields.length})</h4>
                {formFields.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    No fields added yet. Use the form below to add fields.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {formFields.map((field, index) => (
                      <div key={field.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {index + 1}. {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <div className="text-xs text-gray-600">
                            {field.name} ({field.type})
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditField(field)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add/Edit Field Form */}
              <div className="border-t pt-6">
                <h4 className="font-medium mb-3">
                  {editingField ? 'Edit Field' : 'Add New Field'}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Label <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={fieldLabel}
                      onChange={(e) => {
                        const label = e.target.value
                        setFieldLabel(label)
                        // Auto-generate field name from label
                        if (!editingField) {
                          const generatedName = label
                            .toLowerCase()
                            .replace(/[^a-z0-9\s]/g, '') // Remove special chars except spaces
                            .trim()
                            .replace(/\s+/g, '_') // Replace spaces with underscores
                          setFieldName(generatedName)
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., First Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Field Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={fieldName}
                      onChange={(e) => setFieldName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., first_name"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-generated from label (editable)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Field Type</label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as FormField['type'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="date">Date</option>
                      <option value="select">Dropdown</option>
                      <option value="textarea">Text Area</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="file">File Upload</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={fieldPlaceholder}
                      onChange={(e) => setFieldPlaceholder(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Placeholder text..."
                    />
                  </div>

                  {fieldType === 'select' && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Options (comma-separated)</label>
                      <input
                        type="text"
                        value={fieldOptions}
                        onChange={(e) => setFieldOptions(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Option 1, Option 2, Option 3"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1">Min Length</label>
                    <input
                      type="number"
                      value={fieldMinLength}
                      onChange={(e) => setFieldMinLength(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Max Length</label>
                    <input
                      type="number"
                      value={fieldMaxLength}
                      onChange={(e) => setFieldMaxLength(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={fieldRequired}
                        onChange={(e) => setFieldRequired(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium">Required Field</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {editingField && (
                    <button
                      onClick={() => {
                        setEditingField(null)
                        resetFieldForm()
                      }}
                      className="btn"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={handleAddField}
                    className="btn btn-primary"
                  >
                    {editingField ? 'Update Field' : 'Add Field'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-between">
          <button
            onClick={onClose}
            className="btn"
            disabled={loading}
          >
            Cancel
          </button>
          
          <div className="flex gap-2">
            {step === 'fields' && (
              <button
                onClick={() => setStep('basic')}
                className="btn"
                disabled={loading}
              >
                ← Back
              </button>
            )}
            
            {step === 'basic' ? (
              <button
                onClick={() => {
                  if (!templateName.trim()) {
                    alert('Template name is required')
                    return
                  }
                  setStep('fields')
                }}
                className="btn btn-primary"
              >
                Next: Add Fields →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Template'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
