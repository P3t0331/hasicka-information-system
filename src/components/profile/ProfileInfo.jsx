import React from 'react';

function ProfileItem({ label, value, icon }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <div style={{
                width: '40px', height: '40px', background: '#f5f5f5',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem'
            }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    {label}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 500, color: '#333' }}>
                    {value}
                </div>
            </div>
        </div>
    );
}

export default function ProfileInfo({ userData, isEditing, setIsEditing, editForm, setEditForm, handleUpdateProfile }) {
    return (
        <div className="card" style={{ height: 'fit-content' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', color: '#333' }}>👤 Osobní Údaje</h3>
                {!isEditing && (
                    <button
                        className="btn btn-secondary"
                        onClick={() => setIsEditing(true)}
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                    >
                        Upravit
                    </button>
                )}
            </div>

            {isEditing ? (
                <form onSubmit={handleUpdateProfile}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="input-label">Jméno</label>
                            <input className="input-field" value={editForm.firstName || ''} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Příjmení</label>
                            <input className="input-field" value={editForm.lastName || ''} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} required />
                        </div>
                    </div>
                    <div className="input-group">
                        <label className="input-label">Telefon</label>
                        <input className="input-field" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Adresa Bydliště</label>
                        <input className="input-field" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button className="btn btn-success" style={{ background: '#2e7d32', color: 'white', flex: 1 }} type="submit">Uložit změny</button>
                        <button className="btn btn-secondary" style={{ flex: 1 }} type="button" onClick={() => setIsEditing(false)}>Zrušit</button>
                    </div>
                </form>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <ProfileItem label="Email (Přihlášení)" value={userData.email} icon="✉️" />
                    <ProfileItem label="Telefon" value={userData.phone || 'Neuvedeno'} icon="📱" />
                    <ProfileItem label="Adresa" value={userData.address || 'Neuvedeno'} icon="🏠" />
                </div>
            )}
        </div>
    );
}
