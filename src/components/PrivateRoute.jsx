import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-red)' }}>
          Načítání...
        </div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" />;
}
