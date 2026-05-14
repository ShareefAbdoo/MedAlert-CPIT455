import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { patientsApi } from '../../services/api';
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

export default function PatientDetail() {
  const { id } = useParams();
  const [patient,  setPatient]  = useState(null);
  const [meds,     setMeds]     = useState([]);
  const [doseLogs, setDoseLogs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('medications');

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

  return (
    <>
      <Navbar />
      <div className="page">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Link to="/nurse/dashboard" style={{ color: '#2563eb', fontSize: '0.875rem' }}>← Dashboard</Link>
        </div>

        {/* Patient header */}
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '50%', background: '#dbeafe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.75rem', flexShrink: 0,
          }}>👤</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>{patient.full_name}</h1>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>MRN: <strong>{patient.medical_record_no}</strong></span>
              <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                DOB: <strong>{format(parseISO(patient.date_of_birth), 'MMM d, yyyy')}</strong>
              </span>
              {patient.diagnosis && (
                <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>Diagnosis: <strong>{patient.diagnosis}</strong></span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
          {['medications', 'dose-logs'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '0.625rem 1.25rem',
              border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#2563eb' : '#6b7280',
              borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
              fontSize: '0.9rem', textTransform: 'capitalize',
            }}>
              {t === 'dose-logs' ? 'Dose History' : 'Medications'}
            </button>
          ))}
        </div>

        {tab === 'medications' && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Active Medications</h2>
            {meds.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No active medications.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Medication</th>
                      <th>Dosage</th>
                      <th>Route</th>
                      <th>Frequency</th>
                      <th>Max Dose</th>
                      <th>End Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meds.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td>{m.dosage} {m.unit}</td>
                        <td>{m.route}</td>
                        <td>{m.frequency}</td>
                        <td>
                          <span className="badge badge-amber">{m.max_dose} {m.unit}</span>
                        </td>
                        <td>{m.end_date ? format(parseISO(m.end_date), 'MMM d, yyyy') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'dose-logs' && (
          <div className="card">
            <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Dose History</h2>
            {doseLogs.length === 0 ? (
              <p style={{ color: '#6b7280' }}>No dose history yet.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Medication</th>
                      <th>Dose Given</th>
                      <th>Status</th>
                      <th>Nurse</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doseLogs.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {format(parseISO(l.administered_at), 'MMM d, h:mm a')}
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
        )}
      </div>
    </>
  );
}
