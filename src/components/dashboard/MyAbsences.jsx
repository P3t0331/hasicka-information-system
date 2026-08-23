import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function MyAbsences({ absences }) {
    const [showPast, setShowPast] = useState(false);

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const todayStr = new Date().toISOString().slice(0, 10);
    
    const activeAbsences = absences
        .filter(a => a.endDate >= todayStr)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
    const pastAbsences = absences
        .filter(a => a.endDate < todayStr)
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // newest past first

    const displayAbsences = showPast ? [...activeAbsences, ...pastAbsences] : activeAbsences;

    return (
        <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>🚫 Moje absence</h2>
                <Link to="/shifts" className="btn btn-sm" style={{ padding: '0.4rem 0.8rem' }}>
                    Spravovat
                </Link>
            </div>

            {displayAbsences.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {displayAbsences.map((absence, idx) => {
                        const startDate = new Date(absence.startDate);
                        const endDate = new Date(absence.endDate);
                        const today = new Date();
                        // Reset time to 00:00:00 for accurate day diff
                        today.setHours(0,0,0,0);
                        startDate.setHours(0,0,0,0);
                        endDate.setHours(0,0,0,0);
                        
                        const daysUntil = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
                        const isOngoing = startDate <= today && endDate >= today;
                        const isPast = endDate < today;

                        return (
                            <div key={idx} className="dashboard-card" style={{ 
                                padding: '1rem', 
                                borderLeft: `4px solid ${isOngoing ? 'var(--warning)' : isPast ? 'var(--text-faint)' : 'var(--text-muted)'}`,
                                opacity: isPast ? 0.7 : 1
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', textDecoration: isPast ? 'line-through' : 'none' }}>
                                            {absence.reason}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            {formatDate(absence.startDate)} - {formatDate(absence.endDate)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        {isOngoing ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                                PROBÍHÁ
                                            </span>
                                        ) : isPast ? (
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--surface-alt)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                                                PROBĚHLO
                                            </span>
                                        ) : daysUntil > 0 ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                <div className="dashboard-card" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    Žádné {showPast ? '' : 'nadcházející'} absence.
                </div>
            )}
            
            {pastAbsences.length > 0 && (
                <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                    <button 
                        onClick={() => setShowPast(!showPast)}
                        style={{
                            background: 'none', border: 'none', color: 'var(--info)',
                            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                            textDecoration: 'underline'
                        }}
                    >
                        {showPast ? 'Skrýt historii' : `Zobrazit historii (${pastAbsences.length})`}
                    </button>
                </div>
            )}
        </section>
    );
}
