import React, { useState } from 'react';

export default function LoginForm({ onSubmit, loading, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="input-group">
        <label className="input-label">Email</label>
        <input
          className="input-field"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
      </div>

      <div className="input-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
          <label className="input-label" style={{ margin: 0 }}>Heslo</label>
          <span
            style={{ fontSize: '0.8rem', color: 'var(--primary-red)', cursor: 'pointer' }}
            onClick={onForgotPassword}
          >
            Zapomněli jste heslo?
          </span>
        </div>
        <input
          className="input-field"
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>

      <button disabled={loading} className="btn btn-primary w-full" type="submit">
        {loading ? 'Přihlašuji...' : 'Přihlásit se'}
      </button>
    </form>
  );
}
