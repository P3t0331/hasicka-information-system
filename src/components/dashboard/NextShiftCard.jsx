import React from 'react';
import { Link } from 'react-router-dom';

export default function NextShiftCard({ allShifts, userData }) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🚒 Moje nejbližší služba
                </h2>
            </div>

            {allShifts.length > 0 ? (
                (() => {
                    const shift = allShifts[0];
                    return (
                        <div key={shift.date + shift.type} className="dashboard-card highlight" style={{ padding: '1.5rem', borderLeft: '4px solid #E53935' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E53935', marginBottom: '0.25rem', lineHeight: 1.2 }}>
                                        {formatDate(shift.date)}
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '1.4rem' }}>{shift.type === 'denní' ? '☀️' : '🌙'}</span>
                                        {shift.type === 'denní' ? 'Denní služba' : 'Noční služba'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#333' }}>
                                        {shift.start}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                        do {shift.end}
                                    </div>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid #ffcdd2', paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '0.5px' }}>
                                        Kolegové
                                    </div>
                                    <div style={{ fontWeight: 600, color: '#333', fontSize: '0.9rem' }}>
                                        {shift.colleagues && shift.colleagues.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                                {shift.colleagues.map((name, i) => (
                                                    <span key={i}>{name}</span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ color: '#888', fontStyle: 'italic' }}>Žádní další kolegové</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '0.5px' }}>
                                        Role
                                    </div>
                                    <div style={{ fontWeight: 600, color: '#333' }}>
                                        {userData?.role || 'Hasič'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()
            ) : (
                <div className="dashboard-card" style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
                    Žádné nadcházející služby.
                    <div style={{ marginTop: '0.5rem' }}>
                        <Link to="/shifts" className="btn btn-primary btn-sm">Naplánovat službu</Link>
                    </div>
                </div>
            )}
        </section>
    );
}
