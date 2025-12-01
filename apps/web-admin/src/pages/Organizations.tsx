import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, UserPlus } from 'lucide-react';
import { authenticatedFetch } from '../utils/auth';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  branding: any;
  feature_flags: any;
  created_at: string;
  updated_at: string;
}

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: string;
}

export const Organizations: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    subdomain: '',
  });
  const [userFormData, setUserFormData] = useState<UserFormData>({
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    role: 'tenant_admin'
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingOrg(null);
    setFormData({ name: '', subdomain: '' });
    setShowModal(true);
    setError('');
  };

  const handleEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      subdomain: org.subdomain,
    });
    setShowModal(true);
    setError('');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete organization "${name}"? This will delete ALL associated data.`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/organizations/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchOrganizations();
      } else {
        const error = await response.json();
        alert('Failed to delete organization: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Failed to delete organization');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.subdomain) {
      setError('Name and subdomain are required');
      return;
    }

    try {
      setSubmitLoading(true);
      const method = editingOrg ? 'PUT' : 'POST';
      const url = editingOrg 
        ? `/api/organizations/${editingOrg.id}` 
        : '/api/organizations';

      const response = await authenticatedFetch(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchOrganizations();
        setShowModal(false);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to save organization');
      }
    } catch (error) {
      console.error('Error saving organization:', error);
      setError('Failed to save organization');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCreateUser = (org: Organization) => {
    setSelectedOrg(org);
    setUserFormData({
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      role: 'tenant_admin'
    });
    setShowUserModal(true);
    setError('');
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userFormData.email || !userFormData.first_name || !userFormData.last_name || !userFormData.password) {
      setError('All fields are required');
      return;
    }

    try {
      setSubmitLoading(true);
      
      // First, temporarily switch context to the organization
      const response = await authenticatedFetch('/api/users', {
        method: 'POST',
        headers: {
          'X-Organization-Id': selectedOrg!.id // Pass org ID in header
        },
        body: JSON.stringify(userFormData),
      });

      if (response.ok) {
        alert(`User created successfully for ${selectedOrg!.name}!\n\nEmail: ${userFormData.email}\nPassword: ${userFormData.password}\n\nPlease save these credentials.`);
        setShowUserModal(false);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setError('Failed to save organization');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-xl font-bold mb-4">Organizations</div>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="text-xl font-bold">Organizations / Tenants</div>
          <div className="text-sm text-gray-500">Manage organizations and their settings</div>
        </div>
        <button onClick={handleCreate} className="btn btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Organization
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b font-medium">
          Organizations ({organizations.length})
        </div>
        <div className="divide-y">
          {organizations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No organizations yet. Create your first organization to get started.
            </div>
          ) : (
            organizations.map((org) => (
              <div key={org.id} className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  <Building2 size={24} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{org.name}</div>
                  <div className="text-sm text-gray-500">
                    Subdomain: {org.subdomain} • Created: {new Date(org.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCreateUser(org)}
                    className="btn btn-sm btn-primary flex items-center gap-1"
                  >
                    <UserPlus size={14} /> Create User
                  </button>
                  <button
                    onClick={() => handleEdit(org)}
                    className="btn btn-sm flex items-center gap-1"
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(org.id, org.name)}
                    className="btn btn-sm btn-danger flex items-center gap-1"
                  >
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingOrg ? 'Edit Organization' : 'Create Organization'}
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Organization Name *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Acme Financial"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Subdomain *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="e.g., acme"
                  required
                  disabled={!!editingOrg}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
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
                  {submitLoading ? 'Saving...' : editingOrg ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Creation Modal */}
      {showUserModal && selectedOrg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-2">
              Create User for {selectedOrg.name}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Create the initial tenant administrator who will manage this organization.
            </p>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input
                  type="email"
                  className="input w-full"
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="admin@example.com"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={userFormData.first_name}
                    onChange={(e) => setUserFormData({ ...userFormData, first_name: e.target.value })}
                    placeholder="John"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input
                    type="text"
                    className="input w-full"
                    value={userFormData.last_name}
                    onChange={(e) => setUserFormData({ ...userFormData, last_name: e.target.value })}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Password *</label>
                <input
                  type="password"
                  className="input w-full"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Minimum 8 characters. User can change this later.
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role *</label>
                <select
                  className="input w-full"
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                  required
                >
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="broker">Broker</option>
                  <option value="underwriter">Underwriter</option>
                  <option value="processor">Processor</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  Recommended: Tenant Admin (can create other users)
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
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
                  {submitLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
