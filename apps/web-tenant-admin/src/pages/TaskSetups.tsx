import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckSquare, X } from 'lucide-react';
import { authenticatedFetch } from '../utils/auth';

interface TaskSetup {
  id: string;
  loan_product_id: string;
  name: string;
  description: string;
  task_type: string;
  assigned_role: string;
  sequence_order: number;
  is_required: boolean;
  is_active: boolean;
  estimated_duration_minutes: number;
  instructions: string;
  checklist_items: string[];
  product_name?: string;
  product_type?: string;
}

interface LoanProduct {
  id: string;
  name: string;
  product_type: string;
}

// Default checklist items for common loan origination tasks
const DEFAULT_CHECKLIST_TEMPLATES: Record<string, string[]> = {
  'Income Verification': [
    'Verify employment status',
    'Review pay stubs (last 2 months)',
    'Confirm W2 forms (last 2 years)',
    'Validate tax returns',
    'Check for additional income sources',
  ],
  'Credit Check': [
    'Pull credit report from bureau',
    'Review credit score',
    'Identify negative items',
    'Verify tradelines',
    'Document credit inquiries',
  ],
  'Document Collection': [
    'Government-issued ID',
    'Social Security Card',
    'Proof of address',
    'Bank statements (last 3 months)',
    'Employment verification letter',
  ],
  'Property Appraisal': [
    'Order appraisal report',
    'Schedule property inspection',
    'Review comparable sales',
    'Verify property condition',
    'Confirm appraised value',
  ],
  'Title Search': [
    'Order title report',
    'Review property ownership',
    'Check for liens or encumbrances',
    'Verify legal description',
    'Obtain title insurance quote',
  ],
  'Underwriting Review': [
    'Verify debt-to-income ratio',
    'Assess loan-to-value ratio',
    'Review credit history',
    'Validate income stability',
    'Check reserves and assets',
  ],
  'Final Approval': [
    'Review all documentation',
    'Verify conditions are met',
    'Confirm funding availability',
    'Obtain management approval',
    'Issue commitment letter',
  ],
  'Closing Preparation': [
    'Prepare closing disclosure',
    'Schedule closing appointment',
    'Coordinate with title company',
    'Review settlement statement',
    'Confirm wire instructions',
  ],
}

export const TaskSetups: React.FC = () => {
  const [taskSetups, setTaskSetups] = useState<TaskSetup[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = Basic Info, 2 = Checklist & Details
  const [editingTask, setEditingTask] = useState<TaskSetup | null>(null);
  const [formData, setFormData] = useState({
    loan_product_id: '',
    name: '',
    description: '',
    task_type: 'verification',
    assigned_role: 'broker',
    sequence_order: 1,
    is_required: true,
    is_active: true,
    estimated_duration_minutes: 30,
    instructions: '',
    checklist_items: [] as string[],
  });
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, productsRes] = await Promise.all([
        authenticatedFetch('/api/task-setups'),
        authenticatedFetch('/api/loan-products'),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTaskSetups(Array.isArray(data) ? data : (data.items || []));
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setLoanProducts(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTask(null);
    setFormData({
      loan_product_id: '',
      name: '',
      description: '',
      task_type: 'verification',
      assigned_role: 'broker',
      sequence_order: 1,
      is_required: true,
      is_active: true,
      estimated_duration_minutes: 30,
      instructions: '',
      checklist_items: [],
    });
    setNewChecklistItem('');
    setModalStep(1);
    setShowModal(true);
    setError('');
  };

  const handleEdit = (task: TaskSetup) => {
    setEditingTask(task);
    setFormData({
      loan_product_id: task.loan_product_id,
      name: task.name,
      description: task.description || '',
      task_type: task.task_type,
      assigned_role: task.assigned_role,
      sequence_order: task.sequence_order,
      is_required: task.is_required,
      is_active: task.is_active,
      estimated_duration_minutes: task.estimated_duration_minutes,
      instructions: task.instructions || '',
      checklist_items: task.checklist_items || [],
    });
    setNewChecklistItem('');
    setModalStep(1);
    setShowModal(true);
    setError('');
  };

  const loadDefaultChecklist = (taskName: string) => {
    const defaultItems = DEFAULT_CHECKLIST_TEMPLATES[taskName];
    if (defaultItems) {
      setFormData({ ...formData, name: taskName, checklist_items: [...defaultItems] });
    } else {
      setFormData({ ...formData, name: taskName });
    }
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setFormData({
        ...formData,
        checklist_items: [...formData.checklist_items, newChecklistItem.trim()],
      });
      setNewChecklistItem('');
    }
  };

  const removeChecklistItem = (index: number) => {
    setFormData({
      ...formData,
      checklist_items: formData.checklist_items.filter((_, i) => i !== index),
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete task setup "${name}"?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/task-setups/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Error deleting task setup:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only submit if we're on step 2 (final step)
    if (modalStep !== 2) {
      return;
    }
    
    setError('');

    if (!formData.name || !formData.loan_product_id || !formData.task_type || !formData.assigned_role) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitLoading(true);
      const method = editingTask ? 'PUT' : 'POST';
      const url = editingTask ? `/api/task-setups/${editingTask.id}` : '/api/task-setups';

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchData();
        setShowModal(false);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to save task setup');
      }
    } catch (error) {
      console.error('Error saving task setup:', error);
      setError('Failed to save task setup');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-xl font-bold mb-4">Task Setups</div>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xl font-bold">Task Setups</div>
          <div className="text-sm text-gray-500">Define tasks that will be auto-created for loan applications</div>
        </div>
        <button onClick={handleCreate} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Task Setup
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b font-medium">
          Task Setups ({taskSetups.length})
        </div>
        <div className="divide-y">
          {taskSetups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No task setups yet. Create task templates that will be automatically assigned to applications.
            </div>
          ) : (
            taskSetups.map((task) => (
              <div key={task.id} className="p-4 flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <CheckSquare size={20} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{task.name}</div>
                  <div className="text-sm text-gray-600">{task.description}</div>
                  <div className="text-xs text-gray-500 mt-1 space-x-3">
                    <span>Product: {task.product_name}</span>
                    <span>Type: {task.task_type}</span>
                    <span>Role: {task.assigned_role}</span>
                    <span>Order: #{task.sequence_order}</span>
                    <span>~{task.estimated_duration_minutes} min</span>
                    {task.checklist_items && task.checklist_items.length > 0 && (
                      <span>✓ {task.checklist_items.length} checklist items</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs rounded ${task.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {task.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button onClick={() => handleEdit(task)} className="btn btn-sm flex items-center gap-1">
                    <Edit2 size={14} /> Edit
                  </button>
                  <button onClick={() => handleDelete(task.id, task.name)} className="btn btn-sm btn-danger flex items-center gap-1">
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Two-Step Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl my-8 max-h-[90vh] flex flex-col">
            {/* Header with Progress */}
            <div className="bg-white border-b p-6 pb-4 rounded-t-lg flex-shrink-0">
              <h2 className="text-2xl font-bold mb-4">
                {editingTask ? 'Edit Task Setup' : 'Create Task Setup'}
              </h2>
              
              {/* Progress Indicator */}
              <div className="flex items-center gap-2 mb-2">
                <div className={`flex-1 h-2 rounded-full ${modalStep >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
                <div className={`flex-1 h-2 rounded-full ${modalStep >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
              </div>
              <div className="flex justify-between text-sm">
                <span className={modalStep === 1 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                  1. Basic Information
                </span>
                <span className={modalStep === 2 ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                  2. Checklist & Details
                </span>
              </div>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Form Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                {/* Step 1: Basic Information */}
                {modalStep === 1 && (
                  <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Loan Product *</label>
                    <select
                      className="input w-full text-base"
                      value={formData.loan_product_id}
                      onChange={(e) => setFormData({ ...formData, loan_product_id: e.target.value })}
                      required
                    >
                      <option value="">Select a loan product...</option>
                      {loanProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.product_type})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Task will be created for applications of this product</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Task Name *</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1 text-base"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Income Verification"
                        required
                      />
                      <select
                        className="input text-base"
                        onChange={(e) => {
                          if (e.target.value) {
                            loadDefaultChecklist(e.target.value);
                          }
                        }}
                        value=""
                      >
                        <option value="">Use Template...</option>
                        {Object.keys(DEFAULT_CHECKLIST_TEMPLATES).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Select a template to auto-fill task details and checklist</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      className="input w-full text-base"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this task..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Task Type *</label>
                      <select
                        className="input w-full text-base"
                        value={formData.task_type}
                        onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
                        required
                      >
                        <option value="verification">Verification</option>
                        <option value="underwriting">Underwriting</option>
                        <option value="approval">Approval</option>
                        <option value="document_collection">Document Collection</option>
                        <option value="review">Review</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Assigned Role *</label>
                      <select
                        className="input w-full text-base"
                        value={formData.assigned_role}
                        onChange={(e) => setFormData({ ...formData, assigned_role: e.target.value })}
                        required
                      >
                        <option value="broker">Broker</option>
                        <option value="underwriter">Underwriter</option>
                        <option value="processor">Processor</option>
                        <option value="tenant_admin">Tenant Admin</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Sequence Order</label>
                      <input
                        type="number"
                        className="input w-full text-base"
                        value={formData.sequence_order}
                        onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 1 })}
                        min="1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Order in which task appears</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Estimated Duration (minutes)</label>
                      <input
                        type="number"
                        className="input w-full text-base"
                        value={formData.estimated_duration_minutes}
                        onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) || 30 })}
                        min="1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Expected time to complete</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 p-4 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={formData.is_required}
                        onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Required Task</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Active</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 2: Checklist & Details */}
              {modalStep === 2 && (
                <div className="p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Task Instructions</label>
                    <textarea
                      className="input w-full text-base"
                      rows={4}
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      placeholder="Detailed step-by-step instructions for completing this task..."
                    />
                    <p className="text-xs text-gray-500 mt-1">Provide clear guidance for the assigned role</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Checklist Items</label>
                    <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                      {formData.checklist_items.length > 0 ? (
                        formData.checklist_items.map((item, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                            <CheckSquare size={18} className="text-green-600 flex-shrink-0" />
                            <span className="flex-1 text-sm">{item}</span>
                            <button
                              type="button"
                              onClick={() => removeChecklistItem(index)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Remove item"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                          <CheckSquare size={32} className="mx-auto mb-2 text-gray-400" />
                          <p>No checklist items yet</p>
                          <p className="text-xs mt-1">Add items below or select a template in Step 1</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1 text-base"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addChecklistItem();
                          }
                        }}
                        placeholder="Add a new checklist item..."
                      />
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="btn btn-secondary flex items-center gap-2"
                        disabled={!newChecklistItem.trim()}
                      >
                        <Plus size={16} /> Add Item
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.checklist_items.length} item{formData.checklist_items.length !== 1 ? 's' : ''} • Press Enter to quickly add items
                    </p>
                  </div>
                </div>
              )}
              </div>

              {/* Navigation Buttons */}
              <div className="bg-white border-t p-6 flex justify-between flex-shrink-0 rounded-b-lg">
                <button
                  type="button"
                  onClick={() => {
                    if (modalStep === 1) {
                      setShowModal(false);
                      setModalStep(1);
                    } else {
                      setModalStep(1);
                    }
                  }}
                  className="btn"
                  disabled={submitLoading}
                >
                  {modalStep === 1 ? 'Cancel' : 'Back'}
                </button>
                <div className="flex gap-2">
                  {modalStep === 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setModalStep(2);
                      }}
                      className="btn btn-primary"
                      disabled={!formData.loan_product_id || !formData.name}
                    >
                      Next: Checklist & Details →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitLoading}
                    >
                      {submitLoading ? 'Saving...' : (editingTask ? 'Update Task Setup' : 'Create Task Setup')}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
