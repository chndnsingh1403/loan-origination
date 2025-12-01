import React, { useState, useEffect } from 'react'
import { authenticatedFetch } from '../utils/auth'

type LoanProduct = {
  id: string
  name: string
  description: string
  product_type: string
  min_amount: number
  max_amount: number
  min_term_months: number
  max_term_months: number
  base_rate: number
  max_rate: number
  processing_fee: number
}

export const Products: React.FC = () => {
  const [products, setProducts] = useState<LoanProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>('all')

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await authenticatedFetch('/api/loan-products')
        if (response.ok) {
          const data = await response.json()
          setProducts(data.items || [])
        }
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const filteredProducts = selectedType === 'all' 
    ? products 
    : products.filter(p => p.product_type === selectedType)

  const productTypes = ['all', ...new Set(products.map(p => p.product_type))]

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loan Products</h1>
        <p className="text-gray-600">Available products for your customers</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {productTypes.map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No loan products available
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  {product.product_type}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">{product.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan Amount:</span>
                  <span className="font-medium">
                    ${(product.min_amount / 1000).toFixed(0)}K - ${(product.max_amount / 1000).toFixed(0)}K
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Term:</span>
                  <span className="font-medium">
                    {product.min_term_months} - {product.max_term_months} months
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Rate:</span>
                  <span className="font-medium text-green-600">
                    {(product.base_rate * 100).toFixed(2)}% - {(product.max_rate * 100).toFixed(2)}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-500">Processing Fee:</span>
                  <span className="font-medium">
                    ${product.processing_fee.toFixed(2)}
                  </span>
                </div>
              </div>

              <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Start Application
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
