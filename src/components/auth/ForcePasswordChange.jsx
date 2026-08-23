import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

export default function ForcePasswordChange() {
    const { currentUser, logout } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const rules = [
        { label: '8+ znaků', test: newPassword.length >= 8 },
        { label: 'Velké písmeno', test: /[A-Z]/.test(newPassword) },
        { label: 'Malé písmeno', test: /[a-z]/.test(newPassword) },
        { label: 'Číslo', test: /[0-9]/.test(newPassword) },
    ];

    const validate = () => {
        if (!rules.every(r => r.test)) return 'Heslo nesplňuje požadavky.';
        if (newPassword !== confirm) return 'Hesla se neshodují.';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const err = validate();
        if (err) { setError(err); return; }

        setLoading(true);
        try {
            await updatePassword(currentUser, newPassword);
            await updateDoc(doc(db, 'users', currentUser.uid), {
                mustChangePassword: false,
                tempPassword: null
            });
        } catch (err) {
            if (err.code === 'auth/requires-recent-login') {
                setError('Z bezpečnostních důvodů se odhlaste a přihlaste znovu, poté změňte heslo.');
            } else {
                setError('Chyba při změně hesla: ' + err.message);
            }
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, var(--auth-grad-1) 0%, var(--auth-grad-2) 50%, var(--auth-grad-3) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '20px',
                padding: '2rem',
                width: '100%',
                maxWidth: '420px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
                    <h2 style={{ margin: 0, color: 'var(--auth-grad-1)', fontSize: '1.4rem' }}>Nastavte si heslo</h2>
                    <p style={{ color: 'var(--text-steel)', fontSize: '0.88rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
                        Váš účet byl vytvořen administrátorem. Pro pokračování je nutné nastavit vlastní heslo.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, color: 'var(--text-charcoal)', fontSize: '0.85rem' }}>
                            Nové heslo
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => { setNewPassword(e.target.value); setError(''); }}
                                placeholder="Minimálně 8 znaků"
                                autoFocus
                                required
                                style={{
                                    width: '100%', padding: '0.75rem 2.75rem 0.75rem 0.85rem',
                                    borderRadius: '10px', border: '2px solid var(--border)',
                                    fontSize: '1rem', boxSizing: 'border-box', outline: 'none'
                                }}
                            />
                            <button type="button" onClick={() => setShowNew(v => !v)} style={{
                                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: 0
                            }}>
                                {showNew ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600, color: 'var(--text-charcoal)', fontSize: '0.85rem' }}>
                            Potvrdit heslo
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showConfirm ? 'text' : 'password'}
                                value={confirm}
                                onChange={e => { setConfirm(e.target.value); setError(''); }}
                                placeholder="Zopakujte heslo"
                                required
                                style={{
                                    width: '100%', padding: '0.75rem 2.75rem 0.75rem 0.85rem',
                                    borderRadius: '10px', border: '2px solid var(--border)',
                                    fontSize: '1rem', boxSizing: 'border-box', outline: 'none'
                                }}
                            />
                            <button type="button" onClick={() => setShowConfirm(v => !v)} style={{
                                position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)', padding: 0
                            }}>
                                {showConfirm ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
                        padding: '0.65rem 0.75rem', background: 'var(--surface-alt)', borderRadius: '8px',
                        marginBottom: '1.1rem'
                    }}>
                        {rules.map(r => (
                            <span key={r.label} style={{
                                fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 600,
                                background: r.test ? 'var(--success-bg)' : 'var(--surface-hover)',
                                color: r.test ? 'var(--success-text)' : 'var(--text-gray)',
                                transition: 'all 0.15s'
                            }}>
                                {r.test ? '✓' : '○'} {r.label}
                            </span>
                        ))}
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
                            borderRadius: '8px', color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '1rem'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '0.9rem',
                            borderRadius: '12px', border: 'none',
                            background: loading ? 'var(--border-medium)' : 'linear-gradient(135deg, var(--info-text), var(--info-dark))',
                            color: 'white', fontSize: '1rem', fontWeight: 700,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginBottom: '0.75rem'
                        }}
                    >
                        {loading ? 'Ukládám...' : 'Nastavit heslo a pokračovat →'}
                    </button>
                </form>

                <button
                    onClick={logout}
                    style={{
                        width: '100%', padding: '0.6rem',
                        background: 'none', border: 'none',
                        color: 'var(--text-gray)', fontSize: '0.8rem', cursor: 'pointer'
                    }}
                >
                    Odhlásit se
                </button>
            </div>
        </div>
    );
}
