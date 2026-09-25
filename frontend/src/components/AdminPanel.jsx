import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Key, 
  Copy, 
  Check, 
  X, 
  Search, 
  Eye, 
  EyeOff,
  Edit2,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminPanel({ currentUser, onSwitchUser, onShowToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Add User Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('user');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit User Form State
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await api.admin.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      onShowToast(err.message || 'Could not load users list', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      onShowToast('Please provide a valid email address', 'warning');
      return;
    }
    if (!password.trim()) {
      onShowToast('Password is required', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.admin.createUser({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        fullName: fullName.trim(),
        role
      });

      onShowToast(`User account created for ${email}`, 'success');
      setEmail('');
      setPassword('');
      setFullName('');
      setRole('user');
      setShowAddModal(false);
      fetchUsers();
    } catch (err) {
      onShowToast(err.message || 'Failed to create user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenEdit(u) {
    setEditingUser(u);
    setEditEmail(u.email || '');
    setEditFullName(u.fullName || '');
    setEditPassword(u.password || '');
    setEditRole(u.role || 'user');
    setShowEditModal(true);
  }

  async function handleUpdateUser(e) {
    e.preventDefault();
    if (!editingUser) return;
    if (!editEmail.trim() || !editEmail.includes('@')) {
      onShowToast('Please provide a valid email address', 'warning');
      return;
    }

    setIsEditing(true);
    try {
      await api.admin.updateUser(editingUser.id, {
        email: editEmail.trim().toLowerCase(),
        fullName: editFullName.trim(),
        password: editPassword.trim(),
        role: editRole
      });

      onShowToast(`Credentials updated for ${editEmail}`, 'success');
      setShowEditModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      onShowToast(err.message || 'Failed to update credentials', 'error');
    } finally {
      setIsEditing(false);
    }
  }

  async function handleDeleteUser(id, userEmail) {
    if (userEmail === currentUser?.email) {
      onShowToast('Cannot delete the currently active admin session', 'warning');
      return;
    }

    if (!confirm(`Delete user account "${userEmail}" and remove their credentials?`)) return;

    try {
      await api.admin.deleteUser(id);
      onShowToast(`User ${userEmail} deleted`, 'info');
      fetchUsers();
    } catch (err) {
      onShowToast(err.message || 'Failed to delete user', 'error');
    }
  }

  function togglePasswordVisibility(id) {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  }

  function handleCopyCreds(u) {
    const text = `Email: ${u.email}\nPassword: ${u.password || '••••••••'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(u.id);
    setTimeout(() => setCopiedId(null), 2000);
    onShowToast(`Copied credentials for ${u.email}`, 'info');
  }

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchesQuery = u.email?.toLowerCase().includes(q) || u.fullName?.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' 
      ? true 
      : roleFilter === 'admin' 
        ? u.role === 'admin' 
        : u.role !== 'admin';
    return matchesQuery && matchesRole;
  });

  const adminCount = users.filter(u => u.role === 'admin').length;
  const userCount = users.filter(u => u.role !== 'admin').length;

  return (
    <div className="section-container">
      {/* Header Banner */}
      <div className="section-header-row">
        <div>
          <div className="section-subtitle">Administration</div>
          <h2 className="section-title">User Accounts & Credentials</h2>
          <p className="section-desc">
            Manage registered accounts and their login credentials. Users provisioned here have separate private dashboards and reminder alert queues.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          id="admin-add-user-btn"
        >
          <UserPlus size={15} />
          <span>Add User Account</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">TOTAL REGISTERED</span>
            <div className="kpi-icon-wrap">
              <Users size={16} />
            </div>
          </div>
          <div className="kpi-amount">{users.length}</div>
          <div className="kpi-footer-note">All provisioned accounts</div>
        </div>

        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">ADMINISTRATORS</span>
            <div className="kpi-icon-wrap">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="kpi-amount text-danger">{adminCount}</div>
          <div className="kpi-footer-note">Full administration access</div>
        </div>

        <div className="clean-card finance-kpi-card">
          <div className="kpi-top">
            <span className="kpi-tag">STANDARD USERS</span>
            <div className="kpi-icon-wrap">
              <Users size={16} />
            </div>
          </div>
          <div className="kpi-amount text-success">{userCount}</div>
          <div className="kpi-footer-note">Private productivity suites</div>
        </div>
      </div>

      {/* Users & Creds Directory Table */}
      <div className="clean-card ledger-panel">
        <div className="ledger-header">
          <div className="ledger-title-group">
            <Key size={16} />
            <h4>User Credentials Directory</h4>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="filter-pill-group">
              <button 
                type="button"
                className={`filter-pill ${roleFilter === 'all' ? 'active' : ''}`}
                onClick={() => setRoleFilter('all')}
              >
                All ({users.length})
              </button>
              <button 
                type="button"
                className={`filter-pill ${roleFilter === 'admin' ? 'active' : ''}`}
                onClick={() => setRoleFilter('admin')}
              >
                Admins ({adminCount})
              </button>
              <button 
                type="button"
                className={`filter-pill ${roleFilter === 'user' ? 'active' : ''}`}
                onClick={() => setRoleFilter('user')}
              >
                Users ({userCount})
              </button>
            </div>

            <div className="input-with-icon" style={{ width: '200px' }}>
              <Search size={14} className="input-icon" />
              <input 
                type="text"
                placeholder="Search email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '6px 10px 6px 30px', fontSize: '12px' }}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <span>Loading user credentials...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-substate">
            <p>No user accounts found matching your query.</p>
          </div>
        ) : (
          <div className="transactions-table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>User Email</th>
                  <th>Full Name</th>
                  <th>Password (Creds)</th>
                  <th>Account Type</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id || u.email === currentUser?.email;
                  const isVisible = visiblePasswords[u.id];
                  const passwordDisplay = u.password || '••••••••';
                  const isAdmin = u.role === 'admin';

                  return (
                    <tr key={u.id} className="tx-row">
                      {/* Email */}
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {u.email}
                        </span>
                        {isCurrent && (
                          <span style={{ fontSize: '10px', color: 'var(--success-text)', marginLeft: '6px' }}>
                            (Active Session)
                          </span>
                        )}
                      </td>

                      {/* Full Name */}
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {u.fullName || '—'}
                      </td>

                      {/* Password / Creds */}
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-subtle)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
                          <span className="font-mono" style={{ fontSize: '12.5px', color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {isVisible ? passwordDisplay : '••••••••'}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => togglePasswordVisibility(u.id)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 2px' }}
                            title={isVisible ? 'Hide Password' : 'Show Password'}
                          >
                            {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td>
                        <span 
                          className={`badge ${isAdmin ? 'badge-urgent' : 'badge-low'}`}
                          style={{ fontWeight: 600, letterSpacing: '0.04em' }}
                        >
                          {isAdmin ? 'ADMIN' : 'USER'}
                        </span>
                      </td>

                      {/* Created Date */}
                      <td className="tx-date-cell">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(u)}
                            title="Edit user credentials and role"
                            id={`edit-user-${u.id}`}
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>

                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopyCreds(u)}
                            title="Copy email and password credentials"
                          >
                            {copiedId === u.id ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                            <span>{copiedId === u.id ? 'Copied' : 'Copy Creds'}</span>
                          </button>

                          {!isCurrent && (
                            <button 
                              className="btn btn-secondary btn-icon btn-sm text-danger"
                              onClick={() => handleDeleteUser(u.id, u.email)}
                              title="Delete user account"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3>Add New User Account</h3>
                  <p className="modal-desc">Enter the credentials and select account classification</p>
                </div>
              </div>
              <button className="btn-icon-close" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="auth-form">
              <div className="input-group">
                <label className="input-label">User Email Address (Login ID & Alert Recipient)</label>
                <input 
                  type="email"
                  required
                  placeholder="user@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  id="admin-create-email"
                />
              </div>

              <div className="input-group">
                <label className="input-label">User Password (Credentials)</label>
                <input 
                  type="text"
                  required
                  placeholder="Enter login password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field font-mono"
                  id="admin-create-password"
                />
              </div>

              <div className="form-row-2col">
                <div className="input-group">
                  <label className="input-label">Full Name (Optional)</label>
                  <input 
                    type="text"
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="input-field"
                    id="admin-create-name"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Account Classification</label>
                  <select 
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="select-field"
                    id="admin-create-role"
                  >
                    <option value="user">User (Standard Personal Suite)</option>
                    <option value="admin">Admin (User & Creds Management)</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  id="admin-create-submit-btn"
                >
                  {isSubmitting ? 'Adding...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Credentials Modal */}
      {showEditModal && editingUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3>Edit User Credentials</h3>
                  <p className="modal-desc">Modify login password, account type, or profile details</p>
                </div>
              </div>
              <button className="btn-icon-close" onClick={() => setShowEditModal(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="auth-form">
              <div className="input-group">
                <label className="input-label">User Email Address</label>
                <input 
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="input-field"
                  id="admin-edit-email"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Full Name</label>
                <input 
                  type="text"
                  placeholder="e.g. John Doe"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="input-field"
                  id="admin-edit-name"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Password (Credentials)</label>
                <input 
                  type="text"
                  placeholder="Enter new or existing password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="input-field font-mono"
                  id="admin-edit-password"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Account Classification / Role</label>
                <select 
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="select-field"
                  id="admin-edit-role"
                >
                  <option value="user">User (Standard Personal Productivity Suite)</option>
                  <option value="admin">Admin (User & Credentials Management)</option>
                </select>
              </div>

              <div className="modal-actions-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={isEditing}
                  id="admin-edit-submit-btn"
                >
                  {isEditing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
