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

  // Access enforced by AuthContext (auto-logout if !approved)
  return children;
}
