import React from 'react';

export default function MonthlyStatistics({ monthlyStats }) {
    return (
        <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>📊 Tento měsíc</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚒</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning-bright)' }}>{monthlyStats.shiftsWorked}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Služby</div>
                </div>
                <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>⏱️</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning-bright)' }}>{monthlyStats.hoursWorked}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hodin (Běžné)</div>
                </div>
                <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🛡️</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--info-text)' }}>{monthlyStats.zalohaHoursWorked}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hodin (Stáž)</div>
                </div>
                <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚩</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>{monthlyStats.eventsAttended}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Akce</div>
                </div>
                <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>📚</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-purple-bright)' }}>{monthlyStats.trainingsAttended}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Školení</div>
                </div>
                <div className="dashboard-card" style={{ padding: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚫</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-muted)' }}>{monthlyStats.daysAbsent}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dní nepřítomen</div>
                </div>
            </div>
        </section>
    );
}
