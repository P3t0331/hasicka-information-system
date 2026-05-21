import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, getDocs } from 'firebase/firestore';

const SHIFT_DEFAULTS = {
    dayShift:   { timeFrom: '06:00', timeTo: '14:00' },
    nightShift: { timeFrom: '18:00', timeTo: '05:00' },
};

export default function RetroAssignModal({ modal, onAssign, onClose, title }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const showParams = modal.section === 'dayShift' || modal.section === 'nightShift';
    const defaults = SHIFT_DEFAULTS[modal.section] || { timeFrom: '06:00', timeTo: '14:00' };

    const [fromHome, setFromHome] = useState(false);
    const [customTime, setCustomTime] = useState(false);
    const [timeFrom, setTimeFrom] = useState(defaults.timeFrom);
    const [timeTo, setTimeTo] = useState(defaults.timeTo);

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

    const handleUserClick = (user) => {
        onAssign({
            ...user,
            ...(showParams && fromHome ? { fromHome: true } : {}),
            ...(showParams && customTime ? { timeFrom, timeTo } : {}),
        });
    };

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

                    {/* Shift params – only for day/night shift */}
                    {showParams && (
                        <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {/* From home toggle */}
                            <div
                                onClick={() => setFromHome(v => !v)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '8px',
                                    background: fromHome ? '#E8F5E9' : '#f8f8f8',
                                    border: fromHome ? '1.5px solid #81C784' : '1.5px solid #e0e0e0',
                                    cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
                                }}
                            >
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333' }}>🏠 Z domu (SMS)</div>
                                <div style={{
                                    width: '36px', height: '20px', borderRadius: '10px',
                                    background: fromHome ? '#4CAF50' : '#ddd',
                                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                }}>
                                    <div style={{
                                        position: 'absolute', top: '2px',
                                        left: fromHome ? '18px' : '2px',
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                                        transition: 'left 0.2s',
                                    }} />
                                </div>
                            </div>

                            {/* Custom time toggle */}
                            <div>
                                <div
                                    onClick={() => setCustomTime(v => !v)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: customTime ? '8px 8px 0 0' : '8px',
                                        background: customTime ? '#E3F2FD' : '#f8f8f8',
                                        border: customTime ? '1.5px solid #90CAF9' : '1.5px solid #e0e0e0',
                                        borderBottom: customTime ? 'none' : undefined,
                                        cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#333' }}>⏰ Zkrácená služba</div>
                                    <div style={{
                                        width: '36px', height: '20px', borderRadius: '10px',
                                        background: customTime ? '#2196F3' : '#ddd',
                                        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                                    }}>
                                        <div style={{
                                            position: 'absolute', top: '2px',
                                            left: customTime ? '18px' : '2px',
                                            width: '16px', height: '16px', borderRadius: '50%',
                                            background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                                            transition: 'left 0.2s',
                                        }} />
                                    </div>
                                </div>
                                {customTime && (
                                    <div style={{
                                        display: 'flex', gap: '0.75rem', alignItems: 'center',
                                        padding: '0.65rem 0.85rem',
                                        background: '#E3F2FD',
                                        border: '1.5px solid #90CAF9', borderTop: '1px solid #BBDEFB',
                                        borderRadius: '0 0 8px 8px',
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1565C0', marginBottom: '0.25rem' }}>OD</label>
                                            <input
                                                type="time" value={timeFrom}
                                                onChange={e => setTimeFrom(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.4rem 0.4rem',
                                                    borderRadius: '6px', border: '1.5px solid #90CAF9',
                                                    fontSize: '0.95rem', fontWeight: 600, textAlign: 'center',
                                                    background: 'white', boxSizing: 'border-box',
                                                }}
                                            />
                                        </div>
                                        <div style={{ paddingTop: '1.1rem', color: '#90CAF9', fontWeight: 700 }}>→</div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#1565C0', marginBottom: '0.25rem' }}>DO</label>
                                            <input
                                                type="time" value={timeTo}
                                                onChange={e => setTimeTo(e.target.value)}
                                                style={{
                                                    width: '100%', padding: '0.4rem 0.4rem',
                                                    borderRadius: '6px', border: '1.5px solid #90CAF9',
                                                    fontSize: '0.95rem', fontWeight: 600, textAlign: 'center',
                                                    background: 'white', boxSizing: 'border-box',
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {filtered.map(user => (
                                <button
                                    key={user.uid}
                                    onClick={() => handleUserClick(user)}
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
