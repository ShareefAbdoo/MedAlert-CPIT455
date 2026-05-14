import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { patientsApi, usersApi } from '../../services/api';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

function AddPatientModal({ nurses, onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: '', dateOfBirth: '', medicalRecordNo: '',
    diagnosis: '', assignedNurseId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await patientsApi.create({
        ...form,
        assignedNurseId: form.assignedNurseId || null,
      });
      toast.success(`Patient "${form.fullName}" added`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to add patient');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Register New Patient</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert-banner alert-error"><span>⚠️</span> {error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="John Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input type="date" className="form-input" required value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Medical Record No. *</label>
                <input className="form-input" required value={form.medicalRecordNo} onChange={(e) => setForm({ ...form, medicalRecordNo: e.target.value })} placeholder="MRN-000001" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Diagnosis</label>
                <input className="form-input" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="e.g. Type 2 Diabetes" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Assigned Nurse</label>
                <select className="form-input" value={form.assignedNurseId} onChange={(e) => setForm({ ...form, assignedNurseId: e.target.value })}>
                  <option value="">— Unassigned —</option>
                  {nurses.map((n) => (
                    <option key={n.id} value={n.id}>{n.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Register Patient'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPatientModal({ patient, nurses, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: patient.full_name,
    diagnosis: patient.diagnosis || '',
    assignedNurseId: patient.assigned_nurse_id || '',
    isActive: patient.is_active,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await patientsApi.update(patient.id, {
        ...form,
        assignedNurseId: form.assignedNurseId || null,
      });
      toast.success('Patient updated');
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Edit Patient</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert-banner alert-error"><span>⚠️</span> {error}</div>}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Diagnosis</label>
              <input className="form-input" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Assigned Nurse</label>
              <select className="form-input" value={form.assignedNurseId} onChange={(e) => setForm({ ...form, assignedNurseId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {nurses.map((n) => (
                  <option key={n.id} value={n.id}>{n.full_name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span className="form-label" style={{ margin: 0 }}>Active Patient</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PatientManagement() {
  const [patients, setPatients] = useState([]);
  const [nurses,   setNurses]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [search,   setSearch]   = useState('');

  async function load() {
    try {
      const [p, u] = await Promise.all([patientsApi.list(), usersApi.list()]);
      setPatients(p.data);
      setNurses(u.data.filter((u) => u.role === 'nurse' && u.is_active));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.medical_record_no.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);

  return (
    <>
      <Navbar />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Patient Management</h1>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Register Patient</button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text" className="form-input"
            placeholder="Search by name or MRN…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 380 }}
          />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>MRN</th>
                  <th>Date of Birth</th>
                  <th>Diagnosis</th>
                  <th>Nurse</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.medical_record_no}</td>
                    <td>{format(parseISO(p.date_of_birth), 'MMM d, yyyy')}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{p.diagnosis || '—'}</td>
                    <td>{p.nurse_name || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unassigned</span>}</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && <AddPatientModal nurses={nurses} onClose={() => setShowAdd(false)} onCreated={load} />}
      {editing  && <EditPatientModal patient={editing} nurses={nurses} onClose={() => setEditing(null)} onSaved={load} />}
    </>
  );
}
