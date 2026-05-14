import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { usersApi } from '../../services/api';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

function AddUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'nurse' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await usersApi.create(form);
      toast.success(`User "${form.fullName}" created`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add New User</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert-banner alert-error"><span>⚠️</span> {error}</div>}
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@hospital.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input type="password" className="form-input" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Role *</label>
              <select className="form-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="nurse">Nurse</option>
                <option value="doctor">Doctor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ROLE_BADGE = {
  nurse:  'badge-green',
  doctor: 'badge-blue',
  admin:  'badge-red',
};

export default function UserManagement() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    try {
      const { data } = await usersApi.list();
      setUsers(data);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleActive(user) {
    try {
      await usersApi.update(user.id, { isActive: !user.is_active });
      toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Update failed');
    }
  }

  async function confirmDelete(user) {
    if (!window.confirm(`Delete user "${user.full_name}" permanently? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await usersApi.remove(user.id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);

  return (
    <>
      <Navbar />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>User Management</h1>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add User</button>
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                    <td style={{ color: '#4b5563' }}>{u.email}</td>
                    <td><span className={`badge ${ROLE_BADGE[u.role] || 'badge-gray'}`} style={{ textTransform: 'capitalize' }}>{u.role}</span></td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: '#6b7280', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {format(parseISO(u.created_at), 'MMM d, yyyy')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className={`btn btn-sm ${u.is_active ? 'btn-ghost' : 'btn-success'}`}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => confirmDelete(u)}
                          disabled={deleting === u.id}
                        >
                          {deleting === u.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onCreated={load} />}
    </>
  );
}
