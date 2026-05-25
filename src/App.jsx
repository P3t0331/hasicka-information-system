import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import UpdatePrompt from './components/UpdatePrompt';

const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const ShiftCalendarPage = React.lazy(() => import('./pages/ShiftCalendarPage'));
const StatisticsPage = React.lazy(() => import('./pages/StatisticsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const TrainingsPage = React.lazy(() => import('./pages/TrainingsPage'));
const EventsPage = React.lazy(() => import('./pages/EventsPage'));
const MembersPage = React.lazy(() => import('./pages/MembersPage'));
const MaintenanceLogPage = React.lazy(() => import('./pages/MaintenanceLogPage'));
const CleaningLogPage = React.lazy(() => import('./pages/CleaningLogPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#888', fontSize: '0.95rem' }}>Načítám...</p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <UpdatePrompt />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<AuthPage />} />

              {/* Protected Routes */}
              <Route element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/shifts" element={<ShiftCalendarPage />} />
                <Route path="/skoleni" element={<TrainingsPage />} />
                <Route path="/akce" element={<EventsPage />} />
                <Route path="/udrzba" element={<MaintenanceLogPage />} />
                <Route path="/uklid" element={<CleaningLogPage />} />
                <Route path="/statistiky" element={<StatisticsPage />} />
                <Route path="/clenove" element={<MembersPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>

              {/* Catch all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
