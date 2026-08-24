import React, { useState } from 'react';
import { ROLE_OPTIONS } from '../constants';

export default function CreateUserModal({ onSubmit, onClose, loading }) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(true);
    const [roles, setRoles] = useState(['Hasič']);
    const [error, setError] = useState('');

    const toggleRole = (role) => {
        setRoles(prev => prev.includes(role)
            ? prev.filter(r => r !== role)
            : [...prev, role]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
            setError('Vyplňte všechna povinná pole.');
            return;
        }
        if (password.length < 8) {
            setError('Heslo musí mít alespoň 8 znaků.');
            return;
        }
        if (roles.length === 0) {
            setError('Vyberte alespoň jednu roli.');
            return;
        }
        onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(), password, roles });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">➕ Vytvořit účet pro člena</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div style={{
                        padding: '0.75rem', background: 'var(--warning-bg-soft)', borderRadius: '8px',
                        border: '1px solid var(--accent-gold)', fontSize: '0.85rem', color: 'var(--accent-brown)',
                        marginBottom: '1.25rem', lineHeight: 1.5
                    }}>
                        ℹ️ Člen bude po prvním přihlášení vyzván ke změně hesla. Sdělte mu email a dočasné heslo osobně.
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Jméno *
                                </label>
                                <input
                                    type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                                    autoFocus
                                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Příjmení *
                                </label>
                                <input
                                    type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                                    style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Email *
                            </label>
                            <input
                                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Telefon
                            </label>
                            <input
                                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                                placeholder="777 123 456"
                                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Dočasné heslo *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Minimálně 8 znaků"
                                    required
                                    style={{ width: '100%', padding: '0.65rem 2.5rem 0.65rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)} style={{
                                    position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-muted)', padding: 0
                                }}>
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Role
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                {ROLE_OPTIONS.filter(r => r !== 'Admin').map(role => (
                                    <button
                                        key={role}
                                        type="button"
                                        onClick={() => toggleRole(role)}
                                        style={{
                                            padding: '0.3rem 0.75rem', borderRadius: '16px',
                                            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                                            transition: 'all 0.15s',
                                            background: roles.includes(role) ? 'var(--info-text)' : 'var(--surface-alt)',
                                            color: roles.includes(role) ? 'var(--text-on-dark)' : 'var(--text-secondary)',
                                            border: roles.includes(role) ? '1px solid var(--info-text)' : '1px solid var(--border)'
                                        }}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div style={{
                                padding: '0.75rem', background: 'var(--danger-bg)', borderRadius: '8px',
                                color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '1rem'
                            }}>
                                ⚠️ {error}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button type="button" onClick={onClose} style={{
                                flex: 1, padding: '0.75rem', borderRadius: '8px',
                                border: '1px solid var(--border)', background: 'var(--surface)',
                                color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer'
                            }}>
                                Zrušit
                            </button>
                            <button type="submit" disabled={loading} style={{
                                flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none',
                                background: loading ? 'var(--border-medium)' : 'linear-gradient(135deg, var(--info-text), var(--info-dark))',
                                color: 'var(--text-on-dark)', fontWeight: 700,
                                cursor: loading ? 'not-allowed' : 'pointer'
                            }}>
                                {loading ? 'Vytváření...' : 'Vytvořit účet'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
