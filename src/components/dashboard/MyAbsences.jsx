import React from 'react';
import { Link } from 'react-router-dom';

export default function MyAbsences({ absences }) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    const activeAbsences = absences.filter(a => a.endDate >= todayStr);

    return (
        <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>🚫 Moje absence</h2>
                <Link to="/shifts" className="btn btn-sm" style={{ padding: '0.4rem 0.8rem' }}>
                    Spravovat
                </Link>
            </div>

            {activeAbsences.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeAbsences
                        .slice(0, 3)
                        .map((absence, idx) => {
                            const startDate = new Date(absence.startDate);
                            const endDate = new Date(absence.endDate);
                            const today = new Date();
                            const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
                            const isOngoing = startDate <= today && endDate >= today;

                            return (
                                <div key={idx} className="dashboard-card" style={{ padding: '1rem', borderLeft: `4px solid ${isOngoing ? '#F57C00' : '#757575'}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#333', marginBottom: '0.25rem' }}>
                                                {absence.reason}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            {isOngoing ? (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#F57C00', background: '#FFF3E0', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                                    PROBÍHÁ
                                                </span>
                                            ) : daysUntil > 0 ? (
                                                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                                    Za {daysUntil} {daysUntil === 1 ? 'den' : daysUntil <= 4 ? 'dny' : 'dní'}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            ) : (
                <div className="dashboard-card" style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
                    Žádné nadcházející absence.
                </div>
            )}
        </section>
    );
}
