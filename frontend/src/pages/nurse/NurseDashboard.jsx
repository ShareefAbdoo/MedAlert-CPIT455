import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { patientsApi, dosesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { format, isAfter, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

function statusBadge(status) {
  const map = {
    pending:      { cls: 'badge-amber', label: 'Pending' },
    administered: { cls: 'badge-green', label: 'Done' },
    missed:       { cls: 'badge-red',   label: 'Missed' },
    skipped:      { cls: 'badge-gray',  label: 'Skipped' },
  };
  const { cls, label } = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

export default function NurseDashboard() {
  const { profile } = useAuth();
  const [patients, setPatients]   = useState([]);
  const [pending,  setPending]    = useState([]);
  const [upcoming, setUpcoming]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [adminModal, setAdminModal] = useState(null); // dose schedule to administer
  const [adminLoading, setAdminLoading] = useState(false);
  const [actualDosage, setActualDosage] = useState('');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, pend, up] = await Promise.all([
        patientsApi.list(),
        dosesApi.pending(),
        dosesApi.upcoming(4),
      ]);
      setPatients(p.data);
      setPending(pend.data);
      setUpcoming(up.data);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds to catch new missed doses
  useEffect(() => {
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  async function administer(e) {
    e.preventDefault();
    setAdminLoading(true);
    try {
      await dosesApi.administer({
        scheduleId: adminModal.id,
        actualDosage: parseFloat(actualDosage),
        notes,
      });
      toast.success(`Dose marked as administered`);
      setAdminModal(null);
      setActualDosage('');
      setNotes('');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to record dose');
    } finally {
      setAdminLoading(false);
    }
  }

  const overdue = pending.filter((d) => isAfter(new Date(), parseISO(d.scheduled_time)));

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Nurse Dashboard</h1>
        <p style={{ color: '#6b7280', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          Welcome, {profile?.fullName}. {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>👥</div>
            <div>
              <div className="stat-label">My Patients</div>
              <div className="stat-value">{patients.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>💊</div>
            <div>
              <div className="stat-label">Pending Doses</div>
              <div className="stat-value">{pending.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fee2e2' }}>⚠️</div>
            <div>
              <div className="stat-label">Overdue</div>
              <div className="stat-value" style={{ color: overdue.length ? '#dc2626' : undefined }}>
                {overdue.length}
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>🕐</div>
            <div>
              <div className="stat-label">Due in 4 h</div>
              <div className="stat-value">{upcoming.length}</div>
            </div>
          </div>
        </div>

        {/* Overdue alert */}
        {overdue.length > 0 && (
          <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem' }}>
            <span>🚨</span>
            <strong>{overdue.length} overdue dose{overdue.length > 1 ? 's' : ''}</strong> — please administer immediately or they will be marked missed.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Pending Doses */}
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💊 Pending Doses
              <span className="badge badge-amber">{pending.length}</span>
            </h2>
            {pending.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No pending doses. All caught up!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pending.map((d) => {
                  const late = isAfter(new Date(), parseISO(d.scheduled_time));
                  return (
                    <div key={d.id} style={{
                      border: `1px solid ${late ? '#fecaca' : '#e5e7eb'}`,
                      background: late ? '#fef2f2' : '#fff',
                      borderRadius: '0.5rem', padding: '0.875rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: '#111827' }}>{d.patient_name}</div>
                          <div style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                            {d.medication_name} — {d.dosage} {d.unit} ({d.route})
                          </div>
                          <div style={{ fontSize: '0.8rem', color: late ? '#dc2626' : '#6b7280', marginTop: '0.25rem' }}>
                            {late ? '⚠️ Overdue: ' : '🕐 '}
                            {format(parseISO(d.scheduled_time), 'MMM d, h:mm a')}
                          </div>
                        </div>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => { setAdminModal(d); setActualDosage(String(d.dosage)); }}
                        >
                          Give Dose
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* My Patients */}
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>👥 My Patients</h2>
            {patients.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>No patients assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {patients.map((p) => (
                  <Link key={p.id} to={`/nurse/patients/${p.id}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                    textDecoration: 'none', color: 'inherit',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#111827' }}>{p.full_name}</div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                        MRN: {p.medical_record_no}
                      </div>
                    </div>
                    <span style={{ color: '#2563eb', fontSize: '0.875rem' }}>View →</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Administer Dose Modal */}
      {adminModal && (
        <div className="modal-overlay" onClick={() => setAdminModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Administer Dose</h3>
              <button onClick={() => setAdminModal(null)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>
            <form onSubmit={administer}>
              <div className="modal-body">
                <div style={{ background: '#f9fafb', borderRadius: '0.5rem', padding: '0.875rem' }}>
                  <div><strong>Patient:</strong> {adminModal.patient_name}</div>
                  <div><strong>Medication:</strong> {adminModal.medication_name}</div>
                  <div><strong>Prescribed:</strong> {adminModal.dosage} {adminModal.unit}</div>
                  <div><strong>Max Dose:</strong> {adminModal.max_dose} {adminModal.unit}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Actual Dosage ({adminModal.unit}) *</label>
                  <input
                    type="number" required step="0.001" min="0.001" max={adminModal.max_dose}
                    className="form-input"
                    value={actualDosage}
                    onChange={(e) => setActualDosage(e.target.value)}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Max allowed: {adminModal.max_dose} {adminModal.unit}
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-input" rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any observations…"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setAdminModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={adminLoading}>
                  {adminLoading ? 'Recording…' : 'Confirm Administration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
