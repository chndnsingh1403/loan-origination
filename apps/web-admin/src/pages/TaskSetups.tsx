import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, CheckSquare } from 'lucide-react';
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

export const TaskSetups: React.FC = () => {
  const [taskSetups, setTaskSetups] = useState<TaskSetup[]>([]);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
  });
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
        setTaskSetups(data.items || []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setLoanProducts(data || []);
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
    });
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
    });
    setShowModal(true);
    setError('');
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
            <h2 className="text-xl font-bold mb-4">
              {editingTask ? 'Edit Task Setup' : 'Create Task Setup'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Loan Product *</label>
                  <select
                    className="input w-full"
                    value={formData.loan_product_id}
                    onChange={(e) => setFormData({ ...formData, loan_product_id: e.target.value })}
                    required
                  >
                    <option value="">Select product...</option>
                    {loanProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.product_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Task Name *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Income Verification"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Task description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Task Type *</label>
                  <select
                    className="input w-full"
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
                  <label className="block text-sm font-medium mb-1">Assigned Role *</label>
                  <select
                    className="input w-full"
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

                <div>
                  <label className="block text-sm font-medium mb-1">Sequence Order</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={formData.sequence_order}
                    onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 1 })}
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Estimated Duration (minutes)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={formData.estimated_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: parseInt(e.target.value) || 30 })}
                    min="1"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Instructions</label>
                  <textarea
                    className="input w-full"
                    rows={3}
                    value={formData.instructions}
                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                    placeholder="Detailed instructions for this task..."
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                    />
                    <span className="text-sm">Required Task</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn"
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitLoading}
                >
                  {submitLoading ? 'Saving...' : editingTask ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
