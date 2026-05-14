import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [step, setStep] = useState('credentials'); // 'credentials' | '2fa'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (profile) {
    navigate(`/${profile.role}/dashboard`, { replace: true });
    return null;
  }

  async function handleCredentials(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { profile: p } = await login(email, password);
      if (p.role === 'admin') {
        setStep('2fa');
      } else {
        navigate(`/${p.role}/dashboard`, { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handle2FA(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.verify2FA(totpToken);
      toast.success('2FA verified. Welcome, Admin.');
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.error || 'Invalid 2FA code';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 50%, #2563eb 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💊</div>
          <h1 style={{ color: '#fff', fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            MedAlert
          </h1>
          <p style={{ color: '#bfdbfe', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Clinic Medication Management System
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: '1rem',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          padding: '2rem',
        }}>
          {step === 'credentials' ? (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1.5rem', color: '#111827' }}>
                Sign in to your account
              </h2>

              {error && (
                <div className="alert-banner alert-error" style={{ marginBottom: '1rem' }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    type="email" required autoFocus
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hospital.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password" required
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', marginTop: '0.5rem' }}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>
                Two-Factor Authentication
              </h2>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Enter the 6-digit code from your authenticator app.
              </p>

              {error && (
                <div className="alert-banner alert-error" style={{ marginBottom: '1rem' }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <form onSubmit={handle2FA} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">TOTP Code</label>
                  <input
                    type="text" required autoFocus
                    className="form-input"
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    style={{ letterSpacing: '0.25em', fontSize: '1.25rem', textAlign: 'center' }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading || totpToken.length !== 6}
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}>
                  {loading ? 'Verifying…' : 'Verify Code'}
                </button>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setStep('credentials'); setError(''); setTotpToken(''); }}
                  style={{ width: '100%' }}>
                  Back to login
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#93c5fd', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          CPIT 455 · King Abdulaziz University
        </p>
      </div>
    </div>
  );
}
