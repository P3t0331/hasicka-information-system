import React from 'react';

function InfoRow({ label, value, icon, isLast }) {
    return (
        <div style={{
            display: 'flex',
            gap: '0.9rem',
            alignItems: 'flex-start',
            padding: '0.85rem 0',
            borderBottom: isLast ? 'none' : '1px solid #f2f2f2'
        }}>
            <div style={{
                width: '34px',
                height: '34px',
                background: '#f6f6f6',
                border: '1px solid #ebebeb',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                flexShrink: 0,
                marginTop: '1px'
            }}>
                {icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '0.68rem',
                    color: '#aaa',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: '0.18rem'
                }}>
                    {label}
                </div>
                <div style={{
                    fontSize: '0.95rem',
                    fontWeight: 500,
                    color: '#2a2a2a',
                    wordBreak: 'break-word',
                    lineHeight: 1.4
                }}>
                    {value}
                </div>
            </div>
        </div>
    );
}

export default function ProfileInfo({ userData, isEditing, setIsEditing, editForm, setEditForm, handleUpdateProfile }) {
    return (
        <div style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            padding: '1.5rem',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-soft)',
            border: 'var(--glass-border)'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: isEditing ? '1.1rem' : '0',
                paddingBottom: '0.85rem',
                borderBottom: '1px solid #efefef'
            }}>
                <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#999',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px'
                }}>
                    Osobní údaje
                </div>
                {!isEditing && (
                    <button
                        className="btn btn-secondary"
                        onClick={() => setIsEditing(true)}
                        style={{ padding: '0.3rem 0.85rem', fontSize: '0.8rem', minHeight: 'unset' }}
                    >
                        Upravit
                    </button>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleUpdateProfile}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label">Jméno</label>
                            <input
                                className="input-field"
                                value={editForm.firstName || ''}
                                onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label">Příjmení</label>
                            <input
                                className="input-field"
                                value={editForm.lastName || ''}
                                onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="input-group" style={{ marginBottom: '0.6rem' }}>
                        <label className="input-label">Telefon</label>
                        <input
                            className="input-field"
                            value={editForm.phone || ''}
                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                    </div>
                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                        <label className="input-label">Adresa bydliště</label>
                        <input
                            className="input-field"
                            value={editForm.address || ''}
                            onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '0.65rem', fontSize: '0.88rem' }}
                        >
                            Uložit
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1, padding: '0.65rem', fontSize: '0.88rem' }}
                            onClick={() => setIsEditing(false)}
                        >
                            Zrušit
                        </button>
                    </div>
                </form>
            ) : (
                <div>
                    <InfoRow label="Email" value={userData.email} icon="✉️" />
                    <InfoRow label="Telefon" value={userData.phone || 'Neuvedeno'} icon="📞" />
                    <InfoRow label="Adresa" value={userData.address || 'Neuvedeno'} icon="🏠" isLast />
                </div>
            )}
        </div>
    );
}
