import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PrivateRoute({ children }) {
  const { currentUser, userData, logout, loading } = useAuth();

  if (loading || (currentUser && !userData)) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-red)' }}>
          Načítání...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // Strict check: Block unapproved users from ANY protected content
  if (userData && !userData.approved) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center', height: '100vh', background: 'var(--bg-light)' }}>
        <div className="card" style={{ maxWidth: '400px', margin: '1rem' }}>
          <h2 style={{ color: 'var(--primary-red)', marginBottom: '1rem' }}>Čekání na schválení</h2>
          <p style={{ marginBottom: '1.5rem', lineHeight: '1.5' }}>
            Váš účet musí být schválen správcem systému (VJ), než budete moci prohlížet obsah.
          </p>
          <button className="btn btn-secondary w-full" onClick={() => logout()}>
            Odhlásit se
          </button>
        </div>
      </div>
    );
  }

  return children;
}
