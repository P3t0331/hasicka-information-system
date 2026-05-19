import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { validatePhone, validatePassword } from '../utils/authValidation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  async function handleLoginSubmit({ email, password }) {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(fields) {
    setError('');
    setSuccessMsg('');

    // Validations
    const phoneError = validatePhone(fields.phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }

    const passwordError = validatePassword(fields.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);
    try {
      await signup(fields.email, fields.password, {
        firstName: fields.firstName,
        lastName: fields.lastName,
        phone: fields.phone,
        address: fields.address,
        roles: ['Hasič']
      });

      setSuccessMsg("Registrace úspěšná! Váš účet nyní čeká na schválení administrátorem. Můžete se přihlásit po schválení.");
      setIsLogin(true);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleAuthError(err) {
    console.error("Auth Error:", err);
    let msg = 'Selhalo přihlášení/registrace.';
    
    if (err.code === 'auth/email-already-in-use') {
      msg = 'Tento email je již registrován. Zkuste se přihlásit.';
    } else if (err.code === 'auth/wrong-password') {
      msg = 'Nesprávné heslo.';
    } else if (err.code === 'auth/user-not-found') {
      msg = 'Uživatel s tímto emailem neexistuje.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Neplatný formát emailu.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'Heslo je příliš slabé (Firebase: min. 6 znaků).';
    } else if (err.code === 'auth/invalid-credential') {
      msg = 'Neplatné přihlašovací údaje.';
    } else if (!err.code && err.message) {
      msg = err.message;
    }

    setError(msg);
  }

  return (
    <div className="page-layout flex-center" style={{ background: 'var(--secondary-black)', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '90%', margin: '1rem' }}>
        <div className="flex-center mb-2" style={{ flexDirection: 'column' }}>
          <h1 style={{ color: 'var(--primary-red)', fontSize: '3rem', marginBottom: '0.25rem', letterSpacing: '2px' }}>HASIČKA</h1>
          <p style={{ color: '#888', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>Informační Systém</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && (
          <div className="alert alert-success" style={{ background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' }}>
            {successMsg}
          </div>
        )}

        <h2 className="mb-2" style={{ textAlign: 'center' }}>{isLogin ? 'Přihlášení' : 'Registrace'}</h2>

        {isLogin ? (
          <LoginForm onSubmit={handleLoginSubmit} loading={loading} />
        ) : (
          <RegisterForm onSubmit={handleRegisterSubmit} loading={loading} />
        )}

        <div className="mt-2" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
          {isLogin ? 'Nemáte účet? ' : 'Již máte účet? '}
          <span 
            style={{ color: 'var(--primary-red)', cursor: 'pointer', fontWeight: 'bold' }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setSuccessMsg('');
            }}
          >
            {isLogin ? 'Zaregistrujte se' : 'Přihlaste se'}
          </span>
        </div>
      </div>
    </div>
  );
}
