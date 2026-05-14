import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { patientsApi, reportsApi } from '../../services/api';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

function statusBadge(status) {
  const map = {
    administered: { cls: 'badge-green', label: 'Administered' },
    missed:       { cls: 'badge-red',   label: 'Missed' },
    skipped:      { cls: 'badge-gray',  label: 'Skipped' },
    pending:      { cls: 'badge-amber', label: 'Pending' },
  };
  const { cls, label } = map[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${cls}`}>{label}</span>;
}

// ── Export dropdown ────────────────────────────────────────────────────────────
function ExportMenu({ patientId, mrn }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(null); // 'pdf' | 'csv' | null
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleExport(format) {
    setOpen(false);
    setLoading(format);
    try {
      const slug = `MedAlert_${mrn}_${new Date().toISOString().slice(0, 10)}`;
      if (format === 'pdf') {
        await reportsApi.downloadPdf(patientId, `${slug}.pdf`);
        toast.success('PDF downloaded');
      } else {
        await reportsApi.downloadCsv(patientId, `${slug}.csv`);
        toast.success('CSV downloaded');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || `Export failed`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-primary btn-sm"
        onClick={() => setOpen((o) => !o)}
        disabled={loading !== null}
        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
      >
        {loading ? (
          <>
            <span style={{ width: '0.875rem', height: '0.875rem', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            Exporting…
          </>
        ) : (
          <>⬇ Export Report</>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.12)', zIndex: 50,
          minWidth: 180, overflow: 'hidden',
        }}>
          <div style={{ padding: '0.375rem 0.75rem', fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6' }}>
            Export Format
          </div>
          {[
            { key: 'pdf', icon: '📄', label: 'PDF Report',        desc: 'Formatted, printable' },
            { key: 'csv', icon: '📊', label: 'CSV Spreadsheet',   desc: 'For analysis in Excel' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleExport(opt.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.625rem 0.875rem', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontSize: '1.125rem' }}>{opt.icon}</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{opt.label}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page component ─────────────────────────────────────────────────────────────
export default function PatientHistory() {
  const { id } = useParams();
  const [patient,  setPatient]  = useState(null);
  const [meds,     setMeds]     = useState([]);
  const [doseLogs, setDoseLogs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const [p, m, d] = await Promise.all([
          patientsApi.get(id),
          patientsApi.medications(id),
          patientsApi.doseLogs(id),
        ]);
        setPatient(p.data);
        setMeds(m.data);
        setDoseLogs(d.data);
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Failed to load patient');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);
  if (!patient) return (<><Navbar /><div className="page"><p>Patient not found.</p></div></>);

  const filteredLogs = filter === 'all' ? doseLogs : doseLogs.filter((l) => l.status === filter);

  const stats = {
    total:        doseLogs.length,
    administered: doseLogs.filter((l) => l.status === 'administered').length,
    missed:       doseLogs.filter((l) => l.status === 'missed').length,
    compliance:   doseLogs.length
      ? Math.round((doseLogs.filter((l) => l.status === 'administered').length / doseLogs.length) * 100)
      : 0,
  };

  return (
    <>
      <Navbar />
      <div className="page">
        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/doctor/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Patient List</Link>
        </div>

        {/* Patient header + export */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0,
            }}>👤</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {patient.full_name}
              </h1>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.875rem', color: '#4b5563' }}>
                <span>MRN: <strong>{patient.medical_record_no}</strong></span>
                <span>DOB: <strong>{format(parseISO(patient.date_of_birth), 'MMM d, yyyy')}</strong></span>
                {patient.diagnosis && <span>Dx: <strong>{patient.diagnosis}</strong></span>}
                {patient.nurse_name && <span>Nurse: <strong>{patient.nurse_name}</strong></span>}
              </div>
            </div>

            {/* Export report button */}
            <ExportMenu patientId={id} mrn={patient.medical_record_no} />
          </div>
        </div>

        {/* Compliance stats */}
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {[
            { icon: '📋', label: 'Total Doses',  value: stats.total,         color: undefined },
            { icon: '✅', label: 'Administered', value: stats.administered,  color: '#16a34a' },
            { icon: '⚠️', label: 'Missed',       value: stats.missed,        color: stats.missed ? '#dc2626' : undefined },
            { icon: '📊', label: 'Compliance',   value: `${stats.compliance}%`, color: stats.compliance >= 80 ? '#16a34a' : '#dc2626' },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: '#f3f4f6' }}>{s.icon}</div>
              <div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Medications table */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Current Medications</h2>
          {meds.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No active medications on record.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Dosage</th><th>Route</th>
                    <th>Frequency</th><th>Max Dose</th><th>Start Date</th><th>End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {meds.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td>{m.dosage} {m.unit}</td>
                      <td>{m.route}</td>
                      <td>{m.frequency}</td>
                      <td><span className="badge badge-amber">{m.max_dose} {m.unit}</span></td>
                      <td>{format(parseISO(m.start_date), 'MMM d, yyyy')}</td>
                      <td>{m.end_date ? format(parseISO(m.end_date), 'MMM d, yyyy') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Dose history table */}
        <div className="card">
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem',
          }}>
            <h2 style={{ fontWeight: 700 }}>
              Dose History
              {filter !== 'all' && (
                <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: 400, color: '#6b7280' }}>
                  ({filteredLogs.length} {filter})
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['all', 'administered', 'missed'].map((f) => (
                <button
                  key={f} onClick={() => setFilter(f)}
                  className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No records found.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th><th>Medication</th><th>Dose</th>
                    <th>Status</th><th>Nurse</th><th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((l) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {format(parseISO(l.administered_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td>{l.medication_name}</td>
                      <td>{l.actual_dosage}</td>
                      <td>{statusBadge(l.status)}</td>
                      <td>{l.nurse_name}</td>
                      <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>{l.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
