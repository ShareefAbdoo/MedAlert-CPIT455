import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { patientsApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    patientsApi.list()
      .then((r) => setPatients(r.data))
      .catch((err) => toast.error(err?.response?.data?.error || 'Failed to load patients'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.medical_record_no.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Patient Records</h1>
        <p style={{ color: '#6b7280', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          Welcome, Dr. {profile?.fullName}. View patient medication history and dose logs.
        </p>

        {/* Search */}
        <div style={{ marginBottom: '1.25rem' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name or MRN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 380 }}
          />
        </div>

        {/* Stats */}
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>👥</div>
            <div>
              <div className="stat-label">Total Patients</div>
              <div className="stat-value">{patients.length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>✅</div>
            <div>
              <div className="stat-label">Active Patients</div>
              <div className="stat-value">{patients.filter((p) => p.is_active).length}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fef3c7' }}>🔍</div>
            <div>
              <div className="stat-label">Search Results</div>
              <div className="stat-value">{filtered.length}</div>
            </div>
          </div>
        </div>

        {/* Patient list */}
        <div className="card">
          <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>All Patients</h2>
          {filtered.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No patients found.</p>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>MRN</th>
                    <th>Diagnosis</th>
                    <th>Assigned Nurse</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                      <td style={{ fontFamily: 'monospace' }}>{p.medical_record_no}</td>
                      <td style={{ color: '#6b7280', fontSize: '0.875rem' }}>{p.diagnosis || '—'}</td>
                      <td>{p.nurse_name || <span style={{ color: '#9ca3af' }}>Unassigned</span>}</td>
                      <td>
                        <span className={`badge ${p.is_active ? 'badge-green' : 'badge-gray'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link to={`/doctor/patients/${p.id}/history`} className="btn btn-ghost btn-sm">
                          View History
                        </Link>
                      </td>
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
