import React, { useState, useEffect } from 'react'
import { authenticatedFetch } from '../utils/auth'
import { useNavigate } from 'react-router-dom'

type LoanProduct = {
  id: string
  name: string
  min_amount: number
  max_amount: number
}

type Template = {
  id: string
  name: string
  loan_product_id: string
  loan_product_name: string
  form_schema: {
    stages: Stage[]
  }
}

type Stage = {
  id: string
  name: string
  fields: Field[]
}

type Field = {
  id: string
  label: string
  type: string
  required: boolean
  options?: string[]
  validation?: any
}

export const NewApplication: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchProducts()
    fetchTemplates()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await authenticatedFetch('/api/loan-products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await authenticatedFetch('/api/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.items || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const handleProductSelect = () => {
    if (!selectedProduct) {
      alert('Please select a loan product')
      return
    }
    
    console.log('Selected Product ID:', selectedProduct)
    console.log('Available Templates:', templates)
    console.log('Templates with product IDs:', templates.map(t => ({ id: t.id, loan_product_id: t.loan_product_id })))
    
    const template = templates.find(t => t.loan_product_id === selectedProduct)
    console.log('Found template:', template)
    
    if (!template) {
      alert('No application template found for this product. Please contact your administrator.')
      return
    }
    
    setSelectedTemplate(template)
    setStep(2)
  }

  const validateCurrentStage = (): boolean => {
    if (!selectedTemplate) return false
    
    const currentStage = selectedTemplate.form_schema.stages[currentStageIndex]
    const newErrors: Record<string, string> = {}
    
    currentStage.fields.forEach(field => {
      if (field.required && !formData[field.id]) {
        newErrors[field.id] = `${field.label} is required`
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (!validateCurrentStage()) {
      return
    }
    
    if (selectedTemplate && currentStageIndex < selectedTemplate.form_schema.stages.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (currentStageIndex > 0) {
      setCurrentStageIndex(currentStageIndex - 1)
    } else {
      setStep(1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await authenticatedFetch('/api/broker/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_product_id: selectedProduct,
          template_id: selectedTemplate?.id,
          applicant_data: formData
        })
      })
      
      if (response.ok) {
        alert('Application submitted successfully!')
        navigate('/applications')
      } else {
        const error = await response.json()
        alert('Failed to submit application: ' + (error.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error submitting application:', error)
      alert('Failed to submit application')
    } finally {
      setLoading(false)
    }
  }

  const renderField = (field: Field) => {
    const value = formData[field.id] || ''
    const error = errors[field.id]

    const handleChange = (val: any) => {
      setFormData({ ...formData, [field.id]: val })
      if (errors[field.id]) {
        setErrors({ ...errors, [field.id]: '' })
      }
    }

    const commonClasses = `w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
      error ? 'border-red-500 bg-red-50' : 'border-gray-300 focus:bg-white hover:border-gray-400'
    }`

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
            placeholder={field.label}
          />
        )
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(parseFloat(e.target.value) || '')}
            className={commonClasses}
            placeholder={field.label}
          />
        )
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
          >
            <option value="">Select {field.label}</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )
      
      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
            rows={4}
            placeholder={field.label}
          />
        )
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className={commonClasses}
          />
        )
      
      case 'checkbox':
        return (
          <div className="flex items-center p-4 bg-gray-50 rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors">
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => handleChange(e.target.checked)}
              className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="ml-3 text-sm font-medium text-gray-700">{field.label}</label>
          </div>
        )
      
      default:
        return <input type="text" value={value} onChange={(e) => handleChange(e.target.value)} className={commonClasses} />
    }
  }

  if (step === 1) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">New Loan Application</h1>
            <p className="text-gray-600">Select a product to get started</p>
          </div>
          
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">Choose Your Loan Product</h2>
            
            <div className="grid gap-4 mb-8">
              {products.map(product => (
                <label
                  key={product.id}
                  className={`relative flex items-center p-5 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedProduct === product.id
                      ? 'border-blue-500 bg-blue-50 shadow-md scale-[1.02]'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  <input
                    type="radio"
                    name="product"
                    value={product.id}
                    checked={selectedProduct === product.id}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                    className="w-5 h-5 text-blue-600 mr-4"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg">{product.name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Amount: ${(product.min_amount / 1000).toFixed(0)}K - ${(product.max_amount / 1000).toFixed(0)}K
                    </div>
                  </div>
                  {selectedProduct === product.id && (
                    <div className="absolute right-5 top-1/2 -translate-y-1/2">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  )}
                </label>
              ))}
            </div>
            
            {products.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
                </svg>
                <p className="text-gray-500">No loan products available</p>
              </div>
            )}
            
            <div className="flex gap-4">
              <button
                onClick={() => navigate('/applications')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProductSelect}
                disabled={!selectedProduct}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-lg shadow-blue-600/30"
              >
                Continue →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 2 && selectedTemplate) {
    const currentStage = selectedTemplate.form_schema.stages[currentStageIndex]
    const progress = ((currentStageIndex + 1) / selectedTemplate.form_schema.stages.length) * 100
    const isLastStage = currentStageIndex === selectedTemplate.form_schema.stages.length - 1

    return (
      <div className="h-full flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-8 py-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedTemplate.name}</h1>
                <p className="text-sm text-gray-600 mt-1">{selectedTemplate.loan_product_name}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Step {currentStageIndex + 1} of {selectedTemplate.form_schema.stages.length}</div>
                <div className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stage Pills */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto pb-2">
            {selectedTemplate.form_schema.stages.map((stage, index) => (
              <div
                key={stage.id}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  index === currentStageIndex
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40'
                    : index < currentStageIndex
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                  index === currentStageIndex ? 'bg-white text-blue-600' :
                  index < currentStageIndex ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                }`}>
                  {index < currentStageIndex ? '✓' : index + 1}
                </span>
                {stage.name}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-200">
                {currentStage.name}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {currentStage.fields.map(field => (
                  <div key={field.id} className={`group ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                    {field.type !== 'checkbox' && (
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                    )}
                    {renderField(field)}
                    {errors[field.id] && (
                      <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                        {errors[field.id]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-gray-200 px-8 py-6 shadow-lg">
          <div className="max-w-6xl mx-auto flex gap-4">
            <button
              onClick={handleBack}
              className="px-8 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleNext}
              disabled={loading}
              className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-lg shadow-blue-600/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Submitting...
                </span>
              ) : isLastStage ? (
                <span className="flex items-center justify-center gap-2">
                  Submit Application
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                </span>
              ) : (
                'Next →'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
