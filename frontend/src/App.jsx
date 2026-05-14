import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useNotifications } from './hooks/useNotifications';

import LoginPage         from './pages/LoginPage';
import NurseDashboard    from './pages/nurse/NurseDashboard';
import PatientDetail     from './pages/nurse/PatientDetail';
import DoctorDashboard   from './pages/doctor/DoctorDashboard';
import PatientHistory    from './pages/doctor/PatientHistory';
import AdminDashboard    from './pages/admin/AdminDashboard';
import UserManagement    from './pages/admin/UserManagement';
import PatientManagement from './pages/admin/PatientManagement';
import MedicationSchedules from './pages/admin/MedicationSchedules';
import AuditLogs         from './pages/admin/AuditLogs';

import ProtectedRoute    from './components/common/ProtectedRoute';
import ErrorBoundary     from './components/common/ErrorBoundary';
import LoadingSpinner    from './components/common/LoadingSpinner';

function AppRoutes() {
  const { loading, profile } = useAuth();
  useNotifications(profile);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Nurse routes */}
      <Route element={<ProtectedRoute allowedRoles={['nurse']} />}>
        <Route path="/nurse/dashboard"            element={<NurseDashboard />} />
        <Route path="/nurse/patients/:id"         element={<PatientDetail />} />
      </Route>

      {/* Doctor routes */}
      <Route element={<ProtectedRoute allowedRoles={['doctor']} />}>
        <Route path="/doctor/dashboard"           element={<DoctorDashboard />} />
        <Route path="/doctor/patients/:id/history" element={<PatientHistory />} />
      </Route>

      {/* Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/dashboard"            element={<AdminDashboard />} />
        <Route path="/admin/users"                element={<UserManagement />} />
        <Route path="/admin/patients"             element={<PatientManagement />} />
        <Route path="/admin/medications"          element={<MedicationSchedules />} />
        <Route path="/admin/audit"                element={<AuditLogs />} />
      </Route>

      {/* Smart home redirect */}
      <Route
        path="/"
        element={
          profile
            ? <Navigate to={`/${profile.role}/dashboard`} replace />
            : <Navigate to="/login" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
