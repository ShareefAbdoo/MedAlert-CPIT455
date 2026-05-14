import React, { useEffect, useState } from 'react';
import Navbar from '../../components/common/Navbar';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { auditApi } from '../../services/api';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

const ACTION_COLOR = {
  DOSE_ADMINISTERED:    'badge-green',
  PATIENT_CREATED:      'badge-blue',
  PATIENT_UPDATED:      'badge-blue',
  USER_CREATED:         'badge-amber',
  USER_UPDATED:         'badge-amber',
  USER_DELETED:         'badge-red',
  MEDICATION_CREATED:   'badge-blue',
  MEDICATION_DELETED:   'badge-red',
  MEDICATION_UPDATED:   'badge-gray',
  DOSE_SCHEDULE_CREATED:'badge-blue',
  '2FA_SETUP':          'badge-gray',
  '2FA_VERIFIED':       'badge-gray',
};

export default function AuditLogs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });
  const [page,    setPage]    = useState(0);
  const LIMIT = 50;

  async function load(reset = false) {
    setLoading(true);
    try {
      const offset = reset ? 0 : page * LIMIT;
      const { data } = await auditApi.list({
        action: filters.action || undefined,
        from:   filters.from   || undefined,
        to:     filters.to     || undefined,
        limit:  LIMIT,
        offset,
      });
      if (reset) { setPage(0); setLogs(data); }
      else       { setLogs(data); }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Navbar />
      <div className="page">
        <h1 className="page-title">Audit Log</h1>
        <p style={{ color: '#6b7280', marginTop: '-1rem', marginBottom: '1.5rem' }}>
          Full action trail — every change logged with user and timestamp.
        </p>

        {/* Filters */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="form-label">Action</label>
              <input className="form-input" placeholder="e.g. DOSE_ADMINISTERED"
                value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">From</label>
              <input type="date" className="form-input"
                value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input type="date" className="form-input"
                value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={() => load(true)}>Search</button>
            <button className="btn btn-ghost" onClick={() => { setFilters({ action: '', from: '', to: '' }); setTimeout(() => load(true), 0); }}>
              Clear
            </button>
          </div>
        </div>

        <div className="card">
          {loading ? <LoadingSpinner center /> : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>IP</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No records found.</td></tr>
                    ) : logs.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                          {format(parseISO(l.created_at), 'MMM d, yyyy h:mm:ss a')}
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>{l.user_name || <span style={{ color: '#9ca3af' }}>System</span>}</td>
                        <td>
                          {l.user_role && (
                            <span className="badge badge-gray" style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                              {l.user_role}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${ACTION_COLOR[l.action] || 'badge-gray'}`} style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                            {l.action}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#4b5563' }}>
                          {l.entity_type ? `${l.entity_type} #${l.entity_id}` : '—'}
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#6b7280', fontFamily: 'monospace' }}>{l.ip_address || '—'}</td>
                        <td style={{ maxWidth: 200, fontSize: '0.8rem', color: '#6b7280' }}>
                          {l.details ? (
                            <span title={JSON.stringify(l.details, null, 2)} style={{ cursor: 'help' }}>
                              {Object.keys(l.details).slice(0, 2).map((k) => `${k}: ${l.details[k]}`).join(', ')}
                              {Object.keys(l.details).length > 2 ? '…' : ''}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {logs.length === LIMIT && (
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPage((p) => p + 1); load(); }}>
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
