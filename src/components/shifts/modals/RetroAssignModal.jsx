import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function RetroAssignModal({ modal, onAssign, onClose, title }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        getDocs(collection(db, 'users')).then(snap => {
            const approved = snap.docs
                .map(d => ({ uid: d.id, ...d.data() }))
                .filter(u => u.approved === true)
                .map(u => ({
                    uid: u.uid,
                    fullName: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                    compactName: `${u.lastName || ''} ${u.firstName?.[0] ? u.firstName[0] + '.' : ''}`.trim(),
                    roles: u.roles || (u.role ? [u.role] : ['Hasič']),
                }))
                .sort((a, b) => a.fullName.localeCompare(b.fullName, 'cs'));
            setUsers(approved);
            setLoading(false);
        });
    }, []);

    const filtered = users.filter(u =>
        u.fullName.toLowerCase().includes(search.toLowerCase())
    );

    const sectionLabel = modal.section === 'dayShift' ? 'Denní služba'
        : modal.section === 'nightShift' ? 'Noční služba'
        : 'Záloha / Stáž';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">{title || `Přiřadit člena – ${sectionLabel}`}</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    {modal.slotKey && (
                        <p style={{ margin: '0 0 0.75rem', color: '#666', fontSize: '0.85rem' }}>
                            Den <strong>{modal.day}.</strong>, pozice <strong>{modal.slotKey}</strong>
                        </p>
                    )}

                    <input
                        type="text"
                        placeholder="Hledat člena..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                        style={{
                            width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
                            border: '1px solid #e0e0e0', fontSize: '0.9rem',
                            marginBottom: '0.75rem', boxSizing: 'border-box'
                        }}
                    />

                    {loading ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#aaa' }}>Načítám...</div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '1rem', background: '#f5f5f5', borderRadius: '8px', textAlign: 'center', color: '#888' }}>
                            Žádný člen nenalezen.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '340px', overflowY: 'auto' }}>
                            {filtered.map(user => (
                                <button
                                    key={user.uid}
                                    onClick={() => onAssign(user)}
                                    style={{
                                        padding: '0.65rem 0.75rem',
                                        background: 'white',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '8px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#FFB300'; e.currentTarget.style.background = '#FFF8E1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.background = 'white'; }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#222' }}>{user.fullName}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>
                                            {user.roles.join(', ')}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '1.1rem', color: '#FFB300' }}>+</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
