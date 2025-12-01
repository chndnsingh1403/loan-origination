import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, Eye, DollarSign, Percent, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { authenticatedFetch } from '../utils/auth';

interface LoanProduct {
  id: number;
  name: string;
  description: string;
  product_type: 'personal' | 'auto' | 'mortgage' | 'business';
  min_amount: number;
  max_amount: number;
  min_term_months: number;
  max_term_months: number;
  base_rate: number;
  max_rate: number;
  processing_fee: number;
  is_active: boolean;
  credit_score_requirement: number;
  income_requirement: number;
  created_at: string;
  updated_at: string;
}

const LoanProducts: React.FC = () => {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<Partial<LoanProduct>>({
    name: '',
    description: '',
    product_type: 'personal',
    min_amount: 0,
    max_amount: 0,
    min_term_months: 0,
    max_term_months: 0,
    base_rate: 0,
    max_rate: 0,
    processing_fee: 0,
    is_active: true,
    credit_score_requirement: 600,
    income_requirement: 0
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await authenticatedFetch('/api/loan-products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      } else {
        throw new Error(`Failed to fetch products: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching loan products:', error);
      setError('Failed to load loan products. Please check your connection and try again.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      product_type: 'personal',
      min_amount: 0,
      max_amount: 0,
      min_term_months: 0,
      max_term_months: 0,
      base_rate: 0,
      max_rate: 0,
      processing_fee: 0,
      is_active: true,
      credit_score_requirement: 600,
      income_requirement: 0
    });
    setShowModal(true);
  };

  const handleEditProduct = (product: LoanProduct) => {
    setEditingProduct(product);
    setFormData(product);
    setShowModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Are you sure you want to delete this loan product?')) return;
    
    try {
      const response = await authenticatedFetch(`/api/loan-products/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting loan product:', error);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      const response = await authenticatedFetch(`/api/loan-products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentStatus })
      });
      
      if (response.ok) {
        await fetchProducts();
      }
    } catch (error) {
      console.error('Error updating product status:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitLoading(true);
      setError('');
      
      const method = editingProduct ? 'PUT' : 'POST';
      const url = editingProduct ? `/api/loan-products/${editingProduct.id}` : '/api/loan-products';
      
      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        await fetchProducts();
        setShowModal(false);
        setEditingProduct(null);
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      console.error('Error saving loan product:', error);
      setError(error.message || 'Failed to save loan product. Please try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || product.product_type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && product.is_active) ||
                         (filterStatus === 'inactive' && !product.is_active);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getProductTypeColor = (type: string) => {
    const colors = {
      personal: 'bg-blue-100 text-blue-800',
      auto: 'bg-green-100 text-green-800',
      mortgage: 'bg-purple-100 text-purple-800',
      business: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (rate: number | string) => {
    const numericRate = typeof rate === 'string' ? parseFloat(rate) : rate;
    return `${(numericRate * 100).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Loan Products</h1>
          <p className="text-gray-600 mt-1">Manage loan products and their configurations</p>
        </div>
        <button
          onClick={handleCreateProduct}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Product</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search loan products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex space-x-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="personal">Personal</option>
              <option value="auto">Auto</option>
              <option value="mortgage">Mortgage</option>
              <option value="business">Business</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{product.name}</h3>
                  <p className="text-gray-600 text-sm line-clamp-2">{product.description}</p>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProductTypeColor(product.product_type)}`}>
                    {product.product_type.charAt(0).toUpperCase() + product.product_type.slice(1)}
                  </span>
                  {product.is_active ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Amount Range</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatCurrency(product.min_amount)} - {formatCurrency(product.max_amount)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Term Range</span>
                  </div>
                  <span className="text-sm font-medium">
                    {product.min_term_months} - {product.max_term_months} months
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Percent className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Interest Rate</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatPercentage(product.base_rate)} - {formatPercentage(product.max_rate)}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleEditProduct(product)}
                  className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg flex items-center justify-center space-x-1 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => handleToggleStatus(product.id, product.is_active)}
                  className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center space-x-1 transition-colors ${
                    product.is_active
                      ? 'bg-red-50 hover:bg-red-100 text-red-600'
                      : 'bg-green-50 hover:bg-green-100 text-green-600'
                  }`}
                >
                  {product.is_active ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Deactivate</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Activate</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDeleteProduct(product.id)}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg flex items-center justify-center space-x-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No loan products found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterType !== 'all' || filterStatus !== 'all'
              ? 'Try adjusting your search criteria or filters.'
              : 'Get started by creating your first loan product.'}
          </p>
          <button
            onClick={handleCreateProduct}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Loan Product</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                {editingProduct ? 'Edit Loan Product' : 'Create New Loan Product'}
              </h2>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Personal Loan Premium"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Type *
                    </label>
                    <select
                      required
                      value={formData.product_type || 'personal'}
                      onChange={(e) => setFormData({ ...formData, product_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="personal">Personal</option>
                      <option value="auto">Auto</option>
                      <option value="mortgage">Mortgage</option>
                      <option value="business">Business</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the loan product features and benefits..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Amount *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.min_amount || ''}
                      onChange={(e) => setFormData({ ...formData, min_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="5000"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Amount *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.max_amount || ''}
                      onChange={(e) => setFormData({ ...formData, max_amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="100000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Term (months) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.min_term_months || ''}
                      onChange={(e) => setFormData({ ...formData, min_term_months: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="12"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Term (months) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formData.max_term_months || ''}
                      onChange={(e) => setFormData({ ...formData, max_term_months: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="60"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Base Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.base_rate || ''}
                      onChange={(e) => setFormData({ ...formData, base_rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="5.99"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Interest Rate (%) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.max_rate || ''}
                      onChange={(e) => setFormData({ ...formData, max_rate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="15.99"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Processing Fee ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.processing_fee || ''}
                      onChange={(e) => setFormData({ ...formData, processing_fee: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="100"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Credit Score
                    </label>
                    <input
                      type="number"
                      min="300"
                      max="850"
                      value={formData.credit_score_requirement || ''}
                      onChange={(e) => setFormData({ ...formData, credit_score_requirement: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Annual Income ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.income_requirement || ''}
                    onChange={(e) => setFormData({ ...formData, income_requirement: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="30000"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active || false}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                    Product is active and available to customers
                  </label>
                </div>
              </div>
              
              <div className="flex space-x-4 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError('');
                  }}
                  disabled={submitLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-75 flex items-center justify-center space-x-2"
                >
                  {submitLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingProduct ? 'Update Product' : 'Create Product'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanProducts;