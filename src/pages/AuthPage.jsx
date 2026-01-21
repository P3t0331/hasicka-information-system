import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AddressInput from '../components/AddressInput';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState(''); // New success state
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  // Registration states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg(''); // Clear success on new submit

    if (!isLogin) {
      // Validate Phone
      // Czech phone regex: Optional +420, then 9 digits, allowing spaces
      const phoneRegex = /^(\+420)? ?[1-9][0-9]{2} ?[0-9]{3} ?[0-9]{3}$/;
      if (!phoneRegex.test(phone)) {
         setError('Neplatný formát telefonního čísla. Použijte např. 777 123 456 nebo +420 777 123 456');
         return;
      }

      // Validate Password Policy
      const passwordErrors = [];
      if (password.length < 8) passwordErrors.push("minimálně 8 znaků");
      if (!/[A-Z]/.test(password)) passwordErrors.push("velké písmeno");
      if (!/[a-z]/.test(password)) passwordErrors.push("malé písmeno");
      if (!/[0-9]/.test(password)) passwordErrors.push("číslici");

      if (passwordErrors.length > 0) {
        setError("Heslo musí obsahovat: " + passwordErrors.join(", ") + ".");
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        navigate('/');
      } else {
        await signup(email, password, {
           firstName,
           lastName,
           phone,
           address,
           roles: ['Hasič']
        });
        
        // Success!
        setSuccessMsg("Registrace úspěšná! Váš účet nyní čeká na schválení administrátorem. Můžete se přihlásit po schválení.");
        setIsLogin(true); // Switch back to login form
        
        // Clear form fields
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setPhone('');
        setAddress('');
      }
    } catch (err) {
      console.error("Auth Error:", err);
      let msg = 'Selhalo přihlášení/registrace.';
      
      // Firebase Auth Error Handling
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
      } else if (!err.code && err.message) {
        // Custom app errors (no Firebase code)
        msg = err.message; 
      } else if (err.code === 'auth/invalid-credential') {
        msg = 'Neplatné přihlašovací údaje.';
      }

      setError(msg);
    }
    setLoading(false);
  }

  return (
    <div className="page-layout flex-center" style={{ background: 'var(--secondary-black)', minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '90%', margin: '1rem' }}>
        <div className="flex-center mb-2" style={{ flexDirection: 'column' }}>
           <h1 style={{ color: 'var(--primary-red)', fontSize: '3rem', marginBottom: '0.25rem', letterSpacing: '2px' }}>HASIČKA</h1>
           <p style={{ color: '#888', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.8rem' }}>Informační Systém</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {successMsg && <div className="alert alert-success" style={{background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9'}}>{successMsg}</div>}

        <h2 className="mb-2" style={{ textAlign: 'center' }}>{isLogin ? 'Přihlášení' : 'Registrace'}</h2>
        
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="input-group">
                <label className="input-label">Jméno</label>
                <input className="input-field" type="text" required value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Příjmení</label>
                <input className="input-field" type="text" required value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Telefon (+420)</label>
                <input 
                  className="input-field" 
                  type="tel" 
                  required 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="777 123 456"
                />
              </div>
              
              <AddressInput 
                value={address} 
                onChange={setAddress} 
                required={true} 
              />
            </>
          )}

          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input-field" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label">Heslo</label>
            <input className="input-field" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          <button disabled={loading} className="btn btn-primary w-full" type="submit">
            {isLogin ? 'Přihlásit se' : 'Zaregistrovat se'}
          </button>
        </form>

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
