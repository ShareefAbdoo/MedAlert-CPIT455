import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { usersApi, patientsApi, dosesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [users, patients, pending] = await Promise.all([
          usersApi.list(),
          patientsApi.list(),
          dosesApi.pending(),
        ]);
        setStats({
          users:    users.data.length,
          nurses:   users.data.filter((u) => u.role === 'nurse').length,
          doctors:  users.data.filter((u) => u.role === 'doctor').length,
          patients: patients.data.length,
          pending:  pending.data.length,
          overdue:  pending.data.filter((d) => new Date() > new Date(d.scheduled_time)).length,
        });
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (<><Navbar /><LoadingSpinner center size="lg" /></>);

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Admin Dashboard</h1>
        <p style={{ color: '#6b7280', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          Welcome, {profile?.fullName}. Here's a system overview.
        </p>

        {stats?.overdue > 0 && (
          <div className="alert-banner alert-error" style={{ marginBottom: '1.5rem' }}>
            <span>🚨</span>
            <strong>{stats.overdue} overdue dose{stats.overdue !== 1 ? 's' : ''}</strong> across all patients. Nurses have been alerted.
          </div>
        )}

        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: '2rem' }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#ede9fe' }}>👥</div>
            <div>
              <div className="stat-label">Total Users</div>
              <div className="stat-value">{stats?.users}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dcfce7' }}>🩺</div>
            <div>
              <div className="stat-label">Nurses / Doctors</div>
              <div className="stat-value">{stats?.nurses} / {stats?.doctors}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#dbeafe' }}>🏥</div>
            <div>
              <div className="stat-label">Patients</div>
              <div className="stat-value">{stats?.patients}</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: stats?.overdue ? '#fee2e2' : '#fef3c7' }}>💊</div>
            <div>
              <div className="stat-label">Pending / Overdue</div>
              <div className="stat-value" style={{ color: stats?.overdue ? '#dc2626' : undefined }}>
                {stats?.pending} / {stats?.overdue}
              </div>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <h2 style={{ fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>Quick Actions</h2>
        <div className="grid-2">
          {[
            { to: '/admin/users',       icon: '👤', label: 'Manage Users',         desc: 'Add, edit, or disable nurse/doctor/admin accounts' },
            { to: '/admin/patients',    icon: '🏥', label: 'Manage Patients',      desc: 'Register patients and assign nurses' },
            { to: '/admin/medications', icon: '💊', label: 'Medication Schedules', desc: 'Create medications and set dose schedules' },
            { to: '/admin/audit',       icon: '📋', label: 'Audit Log',            desc: 'View full action trail across the system' },
          ].map((item) => (
            <Link key={item.to} to={item.to} style={{
              display: 'flex', gap: '1rem', alignItems: 'center',
              background: '#fff', borderRadius: '0.5rem',
              padding: '1.25rem', border: '1px solid #e5e7eb',
              textDecoration: 'none', color: 'inherit',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37,99,235,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; }}
            >
              <div style={{
                width: '3rem', height: '3rem', borderRadius: '0.5rem', background: '#eff6ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                flexShrink: 0,
              }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: '#111827' }}>{item.label}</div>
                <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
