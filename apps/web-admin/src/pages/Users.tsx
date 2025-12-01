
import React, { useEffect, useState } from 'react';
import { authenticatedFetch } from '../utils/auth';

type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
};


const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'tenant_admin', label: 'Tenant Admin' },
  { value: 'broker', label: 'Broker' },
  { value: 'underwriter', label: 'Underwriter' },
  { value: 'processor', label: 'Processor' },
];

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'broker',
    password: '',
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<null | (User & { is_active: boolean })>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchUsers = () => {
    setLoading(true);
    setError(null);
    authenticatedFetch('/api/users')
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch users');
        return res.json();
      })
      .then((data) => {
        setUsers(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch users');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);
    // Basic validation
    if (!addForm.first_name || !addForm.last_name || !addForm.email || !addForm.role || !addForm.password) {
      setAddError('All fields are required.');
      setAddLoading(false);
      return;
    }
    try {
      const res = await authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create user');
      }
      setAddSuccess('User created successfully.');
      setAddForm({ first_name: '', last_name: '', email: '', role: 'broker', password: '' });
      setShowAddModal(false);
      fetchUsers();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  // ...existing code...
  // Edit user handler
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setEditLoading(true);
    setEditError(null);
    setEditSuccess(null);
    // Basic validation
    if (!editForm.first_name || !editForm.last_name || !editForm.role) {
      setEditError('First name, last name, and role are required.');
      setEditLoading(false);
      return;
    }
    try {
      const res = await authenticatedFetch(`/api/users/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          role: editForm.role,
          is_active: editForm.is_active,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update user');
      }
      setEditSuccess('User updated successfully.');
      setShowEditModal(false);
      setEditForm(null);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  // Deactivate/reactivate user
  const handleToggleActive = async (user: User) => {
    setActionLoading(user.id);
    setActionError(null);
    try {
      if (user.is_active) {
        // Deactivate
        if (!window.confirm(`Deactivate user ${user.first_name} ${user.last_name}?`)) {
          setActionLoading(null);
          return;
        }
        const res = await authenticatedFetch(`/api/users/${user.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to deactivate user');
        }
      } else {
        // Reactivate
        const res = await authenticatedFetch(`/api/users/${user.id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: true }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to reactivate user');
        }
      }
      fetchUsers();
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">User Management</h1>
      <button
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => setShowAddModal(true)}
      >
        Add New User
      </button>

      {/* Edit User Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
              onClick={() => { setShowEditModal(false); setEditForm(null); }}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4">Edit User</h2>
            <form onSubmit={handleEditUser}>
              <div className="mb-2">
                <label className="block text-sm font-medium">First Name</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="text"
                  value={editForm.first_name}
                  onChange={e => setEditForm(f => f ? { ...f, first_name: e.target.value } : f)}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Last Name</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="text"
                  value={editForm.last_name}
                  onChange={e => setEditForm(f => f ? { ...f, last_name: e.target.value } : f)}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Role</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={editForm.role}
                  onChange={e => setEditForm(f => f ? { ...f, role: e.target.value } : f)}
                  required
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium">Status</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={editForm.is_active ? 'active' : 'inactive'}
                  onChange={e => setEditForm(f => f ? { ...f, is_active: e.target.value === 'active' } : f)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {editError && <div className="text-red-500 mb-2">{editError}</div>}
              {editSuccess && <div className="text-green-600 mb-2">{editSuccess}</div>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
              onClick={() => setShowAddModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-semibold mb-4">Add New User</h2>
            <form onSubmit={handleAddUser}>
              <div className="mb-2">
                <label className="block text-sm font-medium">First Name</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="text"
                  value={addForm.first_name}
                  onChange={e => setAddForm(f => ({ ...f, first_name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Last Name</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="text"
                  value={addForm.last_name}
                  onChange={e => setAddForm(f => ({ ...f, last_name: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Email</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="email"
                  value={addForm.email}
                  onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium">Role</label>
                <select
                  className="w-full border rounded px-2 py-1"
                  value={addForm.role}
                  onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                  required
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium">Password</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="password"
                  value={addForm.password}
                  onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              {addError && <div className="text-red-500 mb-2">{addError}</div>}
              {addSuccess && <div className="text-green-600 mb-2">{addSuccess}</div>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={addLoading}
              >
                {addLoading ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}

  {actionError && <div className="text-red-500 mb-2">{actionError}</div>}
  {loading ? (
        <div className="text-gray-500">Loading users...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : users.length === 0 ? (
        <div className="text-gray-500">No users found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Last Login</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b">
                  <td className="px-4 py-2">{user.first_name} {user.last_name}</td>
                  <td className="px-4 py-2">{user.email}</td>
                  <td className="px-4 py-2 capitalize">{user.role.replace('_', ' ')}</td>
                  <td className="px-4 py-2">
                    {user.is_active ? (
                      <span className="text-green-600 font-semibold">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{new Date(user.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'}</td>
                  <td className="px-4 py-2">
                    <button
                      className="text-blue-600 hover:underline mr-2"
                      onClick={() => { setShowEditModal(true); setEditForm({ ...user }); }}
                    >
                      Edit
                    </button>
                    {user.is_active ? (
                      <button
                        className="text-red-600 hover:underline"
                        onClick={() => handleToggleActive(user)}
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? 'Deactivating...' : 'Deactivate'}
                      </button>
                    ) : (
                      <button
                        className="text-green-600 hover:underline"
                        onClick={() => handleToggleActive(user)}
                        disabled={actionLoading === user.id}
                      >
                        {actionLoading === user.id ? 'Reactivating...' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Users;
