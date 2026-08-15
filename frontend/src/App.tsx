import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { LandingPage } from './features/landing/LandingPage';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { PatientDashboard } from './features/dashboard/PatientDashboard';
import { DoctorWorkspace } from './features/doctor/DoctorWorkspace';
import { CaretakerWorkspace } from './features/caretaker/CaretakerWorkspace';
import { PatientCareNetwork } from './features/connections/PatientCareNetwork';
import { EEGPage } from './features/eeg/EEGPage';
import { MedicationsPage } from './features/medications/MedicationsPage';
import { LifestylePage } from './features/lifestyle/LifestylePage';
import { EmergencyPage } from './features/emergency/EmergencyPage';
import { ChatPage } from './features/chat/ChatPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { ErrorBoundary } from './components/errors/ErrorBoundary';
import { UnsavedChangesProvider } from './providers/UnsavedChangesProvider';
import { useAuth } from './hooks/useAuth';

/* ────────────────────────────────────────────────────
   Dynamic Dashboard Router — Routes to role-specific workspace
   ──────────────────────────────────────────────────── */
function RoleBasedDashboard() {
  const { user } = useAuth();

  if (user?.role === 'DOCTOR') {
    return <DoctorWorkspace />;
  }
  if (user?.role === 'CARETAKER') {
    return <CaretakerWorkspace />;
  }
  if (user?.role === 'ADMIN') {
    return <AdminDashboard />;
  }
  return <PatientDashboard />;
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <UnsavedChangesProvider>
          <Routes>
          {/* ── Public Routes ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          {/* ── Protected Routes (inside AppShell) ── */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            {/* Dynamic Dashboard based on user role */}
            <Route path="/dashboard" element={<RoleBasedDashboard />} />

            {/* Patient Clinical Modules (Restricted to PATIENT) */}
            <Route
              path="/eeg"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <EEGPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/medications"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <MedicationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lifestyle"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <LifestylePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/emergency"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <EmergencyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/network"
              element={
                <ProtectedRoute allowedRoles={['PATIENT']}>
                  <PatientCareNetwork />
                </ProtectedRoute>
              }
            />

            {/* General Utilities */}
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* Dedicated Role-Restricted Workspaces */}
            <Route
              path="/doctor"
              element={
                <ProtectedRoute allowedRoles={['DOCTOR', 'ADMIN']}>
                  <DoctorWorkspace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/caretaker"
              element={
                <ProtectedRoute allowedRoles={['CARETAKER', 'ADMIN']}>
                  <CaretakerWorkspace />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* ── Catch-all ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </UnsavedChangesProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
