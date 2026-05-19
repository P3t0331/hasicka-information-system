import React from 'react';

export default function NewActivitiesBanner({ newActivities, onDismiss }) {
    if (!newActivities || newActivities.length === 0) return null;

    const formatDate = (isoDate) => {
        if (!isoDate) return '';
        const [, month, day] = isoDate.split('-');
        return `${parseInt(day)}. ${parseInt(month)}.`;
    };

    return (
        <div style={{
            background: 'linear-gradient(135deg, #1E88E5, #1565C0)',
            color: 'white',
            padding: '1.25rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 4px 15px rgba(21, 101, 192, 0.3)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🔔</span>
                <div style={{ width: '100%' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Nové události od poslední návštěvy</h3>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginTop: '0.2rem' }}>
                        Od vaší poslední návštěvy byly přidány nové události:
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {newActivities.map((act) => (
                                <span key={act.id} style={{ display: 'block', fontWeight: 600 }}>
                                    • {act.type === 'training' ? '🎓 Školení' : '🚩 Akce'}: {act.title} ({formatDate(act.date)})
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={onDismiss}
                    style={{
                        background: 'white',
                        color: '#1565C0',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}
                >
                    Rozumím
                </button>
            </div>
        </div>
    );
}
