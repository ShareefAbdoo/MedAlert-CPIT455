import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { patientsApi, medicationsApi } from '../../services/api';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

function AddMedModal({ patients, onClose, onCreated }) {
  const [form, setForm] = useState({
    patientId: '', name: '', dosage: '', unit: 'mg',
    frequency: '', maxDose: '', route: 'oral', startDate: '', endDate: '', instructions: '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (parseFloat(form.dosage) > parseFloat(form.maxDose)) {
      return setError(`Dosage (${form.dosage}) cannot exceed MaxDose (${form.maxDose})`);
    }
    setLoading(true);
    try {
      await medicationsApi.create(form);
      toast.success('Medication created');
      onCreated();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create medication');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Add Medication</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ gap: '0.875rem' }}>
            {error && <div className="alert-banner alert-error"><span>⚠️</span> {error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Patient *</label>
                <select className="form-input" required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}>
                  <option value="">— Select patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.medical_record_no})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Medication Name *</label>
                <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Metformin" />
              </div>
              <div className="form-group">
                <label className="form-label">Dosage *</label>
                <input type="number" step="0.001" min="0.001" className="form-input" required value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500" />
              </div>
              <div className="form-group">
                <label className="form-label">Unit *</label>
                <select className="form-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {['mg', 'mcg', 'g', 'ml', 'IU', 'units', 'tablets', 'capsules'].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Max Dose * <span style={{ fontWeight: 400, color: '#9ca3af' }}>(safety limit)</span></label>
                <input type="number" step="0.001" min="0.001" className="form-input" required value={form.maxDose} onChange={(e) => setForm({ ...form, maxDose: e.target.value })} placeholder="1000" />
              </div>
              <div className="form-group">
                <label className="form-label">Route *</label>
                <select className="form-input" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>
                  {['oral', 'IV', 'IM', 'subcutaneous', 'topical', 'inhaled', 'sublingual', 'rectal'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Frequency *</label>
                <input className="form-input" required value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. Every 8 hours, Once daily" />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input type="date" className="form-input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date</label>
                <input type="date" className="form-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Instructions</label>
                <textarea className="form-input" rows={2} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Take with food…" style={{ resize: 'vertical' }} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Add Medication'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleModal({ medication, onClose, onCreated }) {
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    medicationsApi.getSchedules(medication.id).then((r) => setSchedules(r.data));
  }, [medication.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await medicationsApi.createSchedule(medication.id, { scheduledTime });
      toast.success('Dose scheduled');
      setScheduledTime('');
      const r = await medicationsApi.getSchedules(medication.id);
      setSchedules(r.data);
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Dose Schedules — {medication.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Add Scheduled Time *</label>
              <input type="datetime-local" className="form-input" required value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flexShrink: 0 }}>
              {loading ? '…' : '+ Add'}
            </button>
          </form>

          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.625rem', color: '#374151' }}>
              Existing Schedules ({schedules.length})
            </div>
            {schedules.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No schedules yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 220, overflowY: 'auto' }}>
                {schedules.map((s) => (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb',
                  }}>
                    <span style={{ fontSize: '0.875rem' }}>
                      {format(parseISO(s.scheduled_time), 'MMM d, yyyy h:mm a')}
                    </span>
                    <span className={`badge ${
                      s.status === 'administered' ? 'badge-green' :
                      s.status === 'missed'       ? 'badge-red'   :
                      s.status === 'pending'      ? 'badge-amber' : 'badge-gray'
                    }`} style={{ textTransform: 'capitalize' }}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function MedicationSchedules() {
  const [meds,     setMeds]     = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showAdd,  setShowAdd]  = useState(false);
  const [scheduling, setScheduling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search,   setSearch]   = useState('');

  async function load() {
    try {
      const [m, p] = await Promise.all([medicationsApi.list(), patientsApi.list()]);
      setMeds(m.data);
      setPatients(p.data.filter((pt) => pt.is_active));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(med) {
    if (!window.confirm(`Are you sure you want to delete "${med.name}"?\n\nThis requires a second confirmation.`)) return;
    setDeleting(med.id);
    try {
      const { data } = await medicationsApi.getDeleteToken(med.id);
      if (!window.confirm(`FINAL CONFIRMATION: Delete "${data.medicationName}" permanently?`)) {
        setDeleting(null);
        return;
      }
      await medicationsApi.remove(med.id, data.confirmToken);
      toast.success('Medication deactivated');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  const filtered = meds.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.patient_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);

  return (
    <>
      <Navbar />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Medication Schedules</h1>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Medication</button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input type="text" className="form-input" placeholder="Search by medication or patient…"
            value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 380 }} />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Medication</th>
                  <th>Patient</th>
                  <th>Dosage</th>
                  <th>Max Dose</th>
                  <th>Route</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.name}</td>
                    <td>{m.patient_name}</td>
                    <td>{m.dosage} {m.unit}</td>
                    <td><span className="badge badge-amber">{m.max_dose} {m.unit}</span></td>
                    <td>{m.route}</td>
                    <td style={{ fontSize: '0.8125rem', color: '#4b5563' }}>{m.frequency}</td>
                    <td>
                      <span className={`badge ${m.is_active ? 'badge-green' : 'badge-gray'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setScheduling(m)}>Schedules</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(m)}
                          disabled={deleting === m.id}
                        >
                          {deleting === m.id ? '…' : 'Delete'}
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

      {showAdd    && <AddMedModal patients={patients} onClose={() => setShowAdd(false)} onCreated={load} />}
      {scheduling && <ScheduleModal medication={scheduling} onClose={() => setScheduling(null)} onCreated={load} />}
    </>
  );
}
