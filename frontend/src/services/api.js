import axios from 'axios';
import { auth } from '../firebase';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  me:             () => api.get('/auth/me'),
  registerFcm:    (token) => api.post('/auth/fcm-token', { token }),
  setup2FA:       () => api.post('/auth/2fa/setup'),
  verify2FA:      (token) => api.post('/auth/2fa/verify', { token }),
};

// Users (Admin only)
export const usersApi = {
  list:   ()            => api.get('/users'),
  create: (data)        => api.post('/users', data),
  update: (id, data)    => api.patch(`/users/${id}`, data),
  remove: (id)          => api.delete(`/users/${id}`),
};

// Patients
export const patientsApi = {
  list:       ()         => api.get('/patients'),
  get:        (id)       => api.get(`/patients/${id}`),
  create:     (data)     => api.post('/patients', data),
  update:     (id, data) => api.patch(`/patients/${id}`, data),
  medications:(id)       => api.get(`/patients/${id}/medications`),
  doseLogs:   (id)       => api.get(`/patients/${id}/dose-logs`),
};

// Medications
export const medicationsApi = {
  list:           ()          => api.get('/medications'),
  get:            (id)        => api.get(`/medications/${id}`),
  create:         (data)      => api.post('/medications', data),
  update:         (id, data)  => api.patch(`/medications/${id}`, data),
  getDeleteToken: (id)        => api.get(`/medications/${id}/delete-token`),
  remove:         (id, token) => api.delete(`/medications/${id}`, { data: { confirmToken: token } }),
  createSchedule: (id, data)  => api.post(`/medications/${id}/schedules`, data),
  getSchedules:   (id)        => api.get(`/medications/${id}/schedules`),
};

// Doses
export const dosesApi = {
  pending:     ()      => api.get('/doses/pending'),
  upcoming:    (hours) => api.get(`/doses/upcoming?hours=${hours || 4}`),
  logs:        (params)=> api.get('/doses/logs', { params }),
  administer:  (data)  => api.post('/doses/administer', data),
};

// Audit (Admin only)
export const auditApi = {
  list: (params) => api.get('/audit', { params }),
};

// Reports (Doctor + Admin)
export const reportsApi = {
  json: (patientId) =>
    api.get(`/reports/patients/${patientId}`),

  downloadCsv: async (patientId, filename) => {
    const res = await api.get(`/reports/patients/${patientId}/csv`, {
      responseType: 'blob',
    });
    _triggerDownload(res.data, filename || `report-${patientId}.csv`, 'text/csv');
  },

  downloadPdf: async (patientId, filename) => {
    const res = await api.get(`/reports/patients/${patientId}/pdf`, {
      responseType: 'blob',
      timeout: 30000,
    });
    _triggerDownload(res.data, filename || `report-${patientId}.pdf`, 'application/pdf');
  },
};

function _triggerDownload(blob, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default api;
