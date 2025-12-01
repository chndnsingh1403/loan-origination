import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/auth';

type Permission = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
};

type Role = {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  is_active: boolean;
  created_at: string;
  permissions?: Array<{
    permission_id: string;
    code: string;
    name: string;
    category: string;
  }>;
};

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    permission_ids: [] as string[],
  });
  
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    permission_ids: [] as string[],
  });

  const [actionLoading, setActionLoading] = useState(false);

  // Fetch roles and permissions
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        authenticatedFetch('/api/roles'),
        authenticatedFetch('/api/permissions')
      ]);

      if (!rolesRes.ok || !permsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();

      setRoles(rolesData.items || []);
      setPermissions(permsData.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Group permissions by category
  const permissionsByCategory = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Create role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authenticatedFetch('/api/roles', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create role');
      }

      setSuccessMessage('Role created successfully');
      setCreateForm({ name: '', description: '', permission_ids: [] });
      setShowCreateModal(false);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create role');
    } finally {
      setActionLoading(false);
    }
  };

  // Update role
  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authenticatedFetch(`/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update role');
      }

      setSuccessMessage('Role updated successfully');
      setShowEditModal(false);
      setSelectedRole(null);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete role
  const handleDeleteRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;

    setActionLoading(true);
    setError(null);

    try {
      const res = await authenticatedFetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete role');
      }

      setSuccessMessage('Role deleted successfully');
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete role');
    } finally {
      setActionLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setEditForm({
      name: role.name,
      description: role.description,
      permission_ids: role.permissions?.map(p => p.permission_id) || [],
    });
    setShowEditModal(true);
  };

  // Toggle permission in create form
  const toggleCreatePermission = (permId: string) => {
    setCreateForm(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter(id => id !== permId)
        : [...prev.permission_ids, permId]
    }));
  };

  // Toggle permission in edit form
  const toggleEditPermission = (permId: string) => {
    setEditForm(prev => ({
      ...prev,
      permission_ids: prev.permission_ids.includes(permId)
        ? prev.permission_ids.filter(id => id !== permId)
        : [...prev.permission_ids, permId]
    }));
  };

  // Select all permissions in category
  const selectCategoryPermissions = (category: string, form: 'create' | 'edit') => {
    const categoryPermIds = permissionsByCategory[category]?.map(p => p.id) || [];
    
    if (form === 'create') {
      const allSelected = categoryPermIds.every(id => createForm.permission_ids.includes(id));
      setCreateForm(prev => ({
        ...prev,
        permission_ids: allSelected
          ? prev.permission_ids.filter(id => !categoryPermIds.includes(id))
          : [...new Set([...prev.permission_ids, ...categoryPermIds])]
      }));
    } else {
      const allSelected = categoryPermIds.every(id => editForm.permission_ids.includes(id));
      setEditForm(prev => ({
        ...prev,
        permission_ids: allSelected
          ? prev.permission_ids.filter(id => !categoryPermIds.includes(id))
          : [...new Set([...prev.permission_ids, ...categoryPermIds])]
      }));
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-gray-600 mt-1">Define roles and assign permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Custom Role
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded">
          {error}
        </div>
      )}

      {/* Roles Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading roles...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`border rounded-lg p-6 ${role.is_system_role ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{role.name}</h3>
                  {role.is_system_role && (
                    <span className="text-xs px-2 py-1 bg-blue-200 text-blue-800 rounded mt-1 inline-block">
                      System Role
                    </span>
                  )}
                </div>
                {!role.is_system_role && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(role)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteRole(role.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>

              <p className="text-gray-600 text-sm mb-4">{role.description}</p>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Permissions ({role.permissions?.length || 0})
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {role.permissions && role.permissions.length > 0 ? (
                    role.permissions.map((perm) => (
                      <div
                        key={perm.permission_id}
                        className="text-xs px-2 py-1 bg-gray-100 rounded flex justify-between items-center"
                      >
                        <span>{perm.name}</span>
                        <span className="text-gray-500">{perm.category}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400">No permissions assigned</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Create Custom Role</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Role Name *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                    placeholder="e.g., Senior Underwriter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                    placeholder="Brief description of this role's responsibilities"
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Permissions</h3>
                <div className="space-y-4">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-900">{category}</h4>
                        <button
                          type="button"
                          onClick={() => selectCategoryPermissions(category, 'create')}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {perms.every(p => createForm.permission_ids.includes(p.id)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={createForm.permission_ids.includes(perm.id)}
                              onChange={() => toggleCreatePermission(perm.id)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{perm.name}</div>
                              <div className="text-xs text-gray-500">{perm.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Edit Role: {selectedRole.name}</h2>
              <button
                onClick={() => { setShowEditModal(false); setSelectedRole(null); }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateRole} className="p-6">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Role Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Permissions</h3>
                <div className="space-y-4">
                  {Object.entries(permissionsByCategory).map(([category, perms]) => (
                    <div key={category} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-900">{category}</h4>
                        <button
                          type="button"
                          onClick={() => selectCategoryPermissions(category, 'edit')}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {perms.every(p => editForm.permission_ids.includes(p.id)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {perms.map((perm) => (
                          <label key={perm.id} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={editForm.permission_ids.includes(perm.id)}
                              onChange={() => toggleEditPermission(perm.id)}
                              className="mt-1"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{perm.name}</div>
                              <div className="text-xs text-gray-500">{perm.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setSelectedRole(null); }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
