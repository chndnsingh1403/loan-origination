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
  last_login?: string;
  phone?: string;
  department?: string;
  title?: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  invited_by_first_name?: string;
  invited_by_last_name?: string;
};

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full system access' },
  { value: 'tenant_admin', label: 'Tenant Admin', description: 'Organization administrator' },
  { value: 'broker', label: 'Broker', description: 'Loan origination and lead management' },
  { value: 'underwriter', label: 'Underwriter', description: 'Application review and decisioning' },
  { value: 'processor', label: 'Processor', description: 'Document processing and verification' },
];

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters and search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);
  
  // Forms
  const [addForm, setAddForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'broker',
    password: '',
    phone: '',
    department: '',
    title: '',
  });

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'broker',
    message: '',
  });

  const [editForm, setEditForm] = useState<null | (User & { password?: string })>(null);
  
  // Selection for bulk actions
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.items || []);
      setFilteredUsers(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch invitations
  const fetchInvitations = async () => {
    try {
      const res = await authenticatedFetch('/api/users/invitations');
      if (!res.ok) throw new Error('Failed to fetch invitations');
      const data = await res.json();
      setInvitations(data.items || []);
    } catch (err: any) {
      console.error('Error fetching invitations:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchInvitations();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.first_name.toLowerCase().includes(term) ||
        u.last_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.department && u.department.toLowerCase().includes(term)) ||
        (u.title && u.title.toLowerCase().includes(term))
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(u => u.is_active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(u => !u.is_active);
    }

    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, statusFilter, users]);

  // Add user
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authenticatedFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create user');
      }
      setSuccessMessage('User created successfully');
      setAddForm({ first_name: '', last_name: '', email: '', role: 'broker', password: '', phone: '', department: '', title: '' });
      setShowAddModal(false);
      fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  // Send invitation
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authenticatedFetch('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send invitation');
      }
      const data = await res.json();
      setSuccessMessage(`Invitation sent to ${inviteForm.email}. Link: ${data.invitation_link}`);
      setInviteForm({ email: '', role: 'broker', message: '' });
      setShowInviteModal(false);
      fetchInvitations();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  // Edit user
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm) return;
    setEditLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await authenticatedFetch(`/api/users/${editForm.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          role: editForm.role,
          is_active: editForm.is_active,
          phone: editForm.phone,
          department: editForm.department,
          title: editForm.title,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update user');
      }
      setSuccessMessage('User updated successfully');
      setShowEditModal(false);
      setEditForm(null);
      fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  // Toggle user active status
  const handleToggleActive = async (user: User) => {
    setActionLoading(user.id);
    setError(null);
    try {
      const action = user.is_active ? 'DELETE' : 'PUT';
      const body = user.is_active ? undefined : JSON.stringify({ is_active: true });
      
      const res = await authenticatedFetch(`/api/users/${user.id}`, {
        method: action,
        body,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Action failed');
      }
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) {
      alert('No users selected');
      return;
    }

    const confirmMessage = `Are you sure you want to ${action} ${selectedUsers.size} user(s)?`;
    if (!window.confirm(confirmMessage)) return;

    setActionLoading('bulk');
    setError(null);
    try {
      const res = await authenticatedFetch('/api/users/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action,
          user_ids: Array.from(selectedUsers),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Bulk action failed');
      }
      setSuccessMessage(`Bulk ${action} completed successfully`);
      setSelectedUsers(new Set());
      fetchUsers();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Bulk action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Toggle selection
  const toggleSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  // Select all
  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  // Revoke invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    if (!window.confirm('Revoke this invitation?')) return;
    
    try {
      const res = await authenticatedFetch(`/api/users/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to revoke invitation');
      setSuccessMessage('Invitation revoked');
      fetchInvitations();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke invitation');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and access permissions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInvitationsModal(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Invitations ({invitations.length})
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Invite User
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add User Directly
          </button>
        </div>
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

      {/* Filters */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Search</label>
          <input
            type="text"
            placeholder="Name, email, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="all">All Roles</option>
            {ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Results</label>
          <div className="px-3 py-2 bg-gray-50 border rounded">
            {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded flex justify-between items-center">
          <span className="font-medium">{selectedUsers.size} user(s) selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('activate')}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              disabled={actionLoading === 'bulk'}
            >
              Activate
            </button>
            <button
              onClick={() => handleBulkAction('deactivate')}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
              disabled={actionLoading === 'bulk'}
            >
              Deactivate
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              disabled={actionLoading === 'bulk'}
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedUsers(new Set())}
              className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No users found</div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className={`hover:bg-gray-50 ${selectedUsers.has(user.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleSelection(user.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{user.first_name} {user.last_name}</div>
                    {user.title && <div className="text-xs text-gray-500">{user.title}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {ROLES.find(r => r.value === user.role)?.label || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{user.department || '-'}</td>
                  <td className="px-4 py-3">
                    {user.is_active ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditForm(user); setShowEditModal(true); }}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={actionLoading === user.id}
                        className={`text-sm hover:underline ${user.is_active ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {actionLoading === user.id ? '...' : user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add New User</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleAddUser}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name *</label>
                  <input
                    type="text"
                    value={addForm.first_name}
                    onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={addForm.last_name}
                    onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role *</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label} - {r.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={addForm.department}
                    onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password *</label>
                  <input
                    type="password"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {addLoading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Invite User</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleInviteUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role *</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Message (optional)</label>
                  <textarea
                    value={inviteForm.message}
                    onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                    placeholder="Add a personal message to the invitation..."
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Edit User</h2>
              <button onClick={() => { setShowEditModal(false); setEditForm(null); }} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">First Name</label>
                  <input
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    className="w-full border rounded px-3 py-2 bg-gray-50"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone || ''}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    {ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Department</label>
                  <input
                    type="text"
                    value={editForm.department || ''}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditForm(null); }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invitations Modal */}
      {showInvitationsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Pending Invitations</h2>
              <button onClick={() => setShowInvitationsModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            {invitations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No pending invitations</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invited By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-3 text-sm">{inv.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {ROLES.find(r => r.value === inv.role)?.label || inv.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {inv.invited_by_first_name} {inv.invited_by_last_name}
                      </td>
                      <td className="px-4 py-3 text-sm">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{new Date(inv.expires_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
