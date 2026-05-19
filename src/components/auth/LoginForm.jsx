import React, { useState } from 'react';

export default function LoginForm({ onSubmit, loading }) {
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
        <label className="input-label">Heslo</label>
        <input 
          className="input-field" 
          type="password" 
          required 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        />
      </div>

      <button disabled={loading} className="btn btn-primary w-full" type="submit">
        Přihlásit se
      </button>
    </form>
  );
}
