import React from 'react';

export default function UpcomingActivities({ upcomingActivities }) {
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-').map(Number);
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return date.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <section style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Moje aktivity</h2>
            </div>

            {upcomingActivities.length > 0 ? (
                <div className="activities-list">
                    {upcomingActivities.map(activity => (
                        <div key={activity.id} className={`activity-card ${activity.type}`}>
                            <div className="activity-icon">
                                {activity.type === 'training' ? '📚' : '🚩'}
                            </div>
                            <div className="activity-details">
                                <div className="activity-title">{activity.title}</div>
                                <div className="activity-meta">
                                    <span>📅 {formatDate(activity.date)}</span>
                                    <span>⏰ {activity.time}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="dashboard-card" style={{ textAlign: 'center', color: '#888', padding: '1.5rem' }}>
                    Zatím nemáte žádné naplánované aktivity.
                </div>
            )}
        </section>
    );
}
