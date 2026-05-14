import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const NAV_LINKS = {
  nurse: [
    { to: '/nurse/dashboard', label: 'Dashboard' },
  ],
  doctor: [
    { to: '/doctor/dashboard', label: 'Dashboard' },
  ],
  admin: [
    { to: '/admin/dashboard',   label: 'Dashboard' },
    { to: '/admin/users',       label: 'Users' },
    { to: '/admin/patients',    label: 'Patients' },
    { to: '/admin/medications', label: 'Medications' },
    { to: '/admin/audit',       label: 'Audit Log' },
  ],
};

const ROLE_COLOR = {
  nurse: '#16a34a',
  doctor: '#2563eb',
  admin: '#7c3aed',
};

export default function Navbar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  }

  if (!profile) return null;
  const links = NAV_LINKS[profile.role] || [];
  const color = ROLE_COLOR[profile.role] || '#2563eb';

  return (
    <nav style={{
      background: '#fff', borderBottom: '1px solid #e5e7eb',
      position: 'sticky', top: 0, zIndex: 40,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem',
        display: 'flex', alignItems: 'center', height: '3.75rem',
      }}>
        {/* Brand */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '2rem' }}>
          <span style={{ fontSize: '1.375rem' }}>💊</span>
          <span style={{ fontWeight: 800, fontSize: '1.125rem', color: '#111827' }}>MedAlert</span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: 'flex', gap: '0.25rem', flex: 1 }}>
          {links.map((l) => (
            <Link
              key={l.to} to={l.to}
              style={{
                padding: '0.375rem 0.875rem', borderRadius: '0.375rem',
                fontSize: '0.875rem', fontWeight: 500, color: '#374151',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Role badge + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span style={{
            background: color + '18', color, padding: '0.25rem 0.625rem',
            borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {profile.role}
          </span>
          <span style={{ fontSize: '0.875rem', color: '#4b5563', fontWeight: 500 }}>
            {profile.fullName}
          </span>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.375rem 0.875rem',
              border: '1px solid #d1d5db', borderRadius: '0.375rem',
              background: 'transparent', fontSize: '0.8125rem',
              color: '#374151', cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
