import React from 'react';

export default function ZalohaNotificationBanner({ newZalohaShifts, onDismiss }) {
    if (newZalohaShifts.length === 0) return null;

    return (
        <div style={{
            background: 'linear-gradient(135deg, #FF9800, #F57C00)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 15px rgba(245, 124, 0, 0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Nová důležitá služba (Záloha/Stáž)</h3>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.2rem' }}>
                        Od vaší poslední návštěvy byly vypsány nové služby:
                        {newZalohaShifts.map((s, i) => (
                            <span key={i} style={{ display: 'block', fontWeight: 600, marginTop: '0.2rem' }}>
                                • {s.kindLabel || 'Záloha'} – {s.date} ({s.timeFrom} - {s.timeTo})
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <button
                onClick={onDismiss}
                style={{
                    background: 'white',
                    color: '#F57C00',
                    border: 'none',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
            >
                Přejít na služby
            </button>
        </div>
    );
}
