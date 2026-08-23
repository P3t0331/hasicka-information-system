import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import UpdatePrompt from './components/UpdatePrompt';
import ChangelogModal from './components/ChangelogModal';

const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const ShiftCalendarPage = React.lazy(() => import('./pages/ShiftCalendarPage'));
const StatisticsPage = React.lazy(() => import('./pages/StatisticsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const AdminQuizEditorPage = React.lazy(() => import('./pages/AdminQuizEditorPage'));
const QuizTakePage = React.lazy(() => import('./pages/QuizTakePage'));
const QuizProtocolPage = React.lazy(() => import('./pages/QuizProtocolPage'));
const TrainingsPage = React.lazy(() => import('./pages/TrainingsPage'));
const EventsPage = React.lazy(() => import('./pages/EventsPage'));
const MembersPage = React.lazy(() => import('./pages/MembersPage'));
const MaintenanceLogPage = React.lazy(() => import('./pages/MaintenanceLogPage'));
const CleaningLogPage = React.lazy(() => import('./pages/CleaningLogPage'));
const SuggestionsPage = React.lazy(() => import('./pages/SuggestionsPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '0.75rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #f0f0f0', borderTop: '3px solid #B71C1C', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#aaa', fontSize: '0.88rem', margin: 0 }}>Načítám...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
        <Router>
        <div className="app-container">
          <UpdatePrompt />
          <ChangelogModal />
          <Routes>
            <Route path="/login" element={<Suspense fallback={<PageLoader />}><AuthPage /></Suspense>} />

            {/* Tiskový protokol kvízu — mimo Layout záměrně: stránka nesmí
                obsahovat navigaci, aby se do PDF nevytiskla. Přesto chráněná
                PrivateRoute jako všechny ostatní stránky. */}
            <Route path="/kviz/:quizId/protokol" element={
              <PrivateRoute>
                <Suspense fallback={<PageLoader />}><QuizProtocolPage /></Suspense>
              </PrivateRoute>
            } />

            {/* Protected Routes — Layout stays mounted, only page content suspends */}
            <Route element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route path="/" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
              <Route path="/profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
              <Route path="/shifts" element={<Suspense fallback={<PageLoader />}><ShiftCalendarPage /></Suspense>} />
              <Route path="/skoleni" element={<Suspense fallback={<PageLoader />}><TrainingsPage /></Suspense>} />
              <Route path="/skoleni/kviz/:quizId" element={<Suspense fallback={<PageLoader />}><QuizTakePage /></Suspense>} />
              <Route path="/akce" element={<Suspense fallback={<PageLoader />}><EventsPage /></Suspense>} />
              <Route path="/udrzba" element={<Suspense fallback={<PageLoader />}><MaintenanceLogPage /></Suspense>} />
              <Route path="/uklid" element={<Suspense fallback={<PageLoader />}><CleaningLogPage /></Suspense>} />
              <Route path="/statistiky" element={<Suspense fallback={<PageLoader />}><StatisticsPage /></Suspense>} />
              <Route path="/clenove" element={<Suspense fallback={<PageLoader />}><MembersPage /></Suspense>} />
              <Route path="/navrhy" element={<Suspense fallback={<PageLoader />}><SuggestionsPage /></Suspense>} />
              <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminPage /></Suspense>} />
              <Route path="/admin/kviz/:quizId" element={<Suspense fallback={<PageLoader />}><AdminQuizEditorPage /></Suspense>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        </Router>
        </ThemeProvider>
      </ToastProvider>
      <Analytics />
    </AuthProvider>
  );
}

export default App;
