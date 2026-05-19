import React from 'react';

const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

export default function ActivitiesTab({ eventsData, trainingsData }) {
    // Get all participants with stats
    const userMap = new Map();
    [...eventsData, ...trainingsData].forEach(activity => {
        (activity.participants || []).forEach(p => {
            if (!userMap.has(p.uid)) {
                userMap.set(p.uid, p.name || 'Neznámý');
            }
        });
    });
    const users = Array.from(userMap, ([uid, name]) => ({ uid, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (users.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                <p>Žádné aktivity tento měsíc</p>
            </div>
        );
    }

    // Calculate statistics for each user
    const userStats = users.map(user => {
        const userEvents = eventsData.filter(e =>
            e.participants?.some(p => p.uid === user.uid)
        );
        const userTrainings = trainingsData.filter(t =>
            t.participants?.some(p => p.uid === user.uid)
        );
        const total = userEvents.length + userTrainings.length;

        // Get latest activity
        const allActivities = [
            ...userEvents.map(e => ({ ...e, type: 'event' })),
            ...userTrainings.map(t => ({ ...t, type: 'training' }))
        ].sort((a, b) => b.date.localeCompare(a.date));

        return {
            ...user,
            events: userEvents.length,
            trainings: userTrainings.length,
            total,
            latestActivity: allActivities[0]
        };
    }).sort((a, b) => b.total - a.total);

    const totalEvents = eventsData.length;
    const totalTrainings = trainingsData.length;
    const totalActivities = totalEvents + totalTrainings;
    const activeParticipants = users.length;
    const avgPerPerson = activeParticipants > 0 ? (totalActivities / activeParticipants).toFixed(1) : 0;
    const maxParticipation = Math.max(...userStats.map(u => u.total), 1);

    return (
        <>
            {/* KPI Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #E53935, #C62828)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(229, 57, 53, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚩</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{totalEvents}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Akce celkem</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(156, 39, 176, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{totalTrainings}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Školení celkem</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #1976D2, #1565C0)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{activeParticipants}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Aktivní účastníci</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #388E3C, #2E7D32)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(56, 142, 60, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{avgPerPerson}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Průměr na osobu</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                {/* TOP 5 LEADERBOARD */}
                <div className="card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>🏆 Top 5 Nejaktivnějších</h3>
                    </div>
                    <div style={{ padding: '0.5rem 1rem' }}>
                        {userStats.slice(0, 5).map((user, i) => {
                            const pct = (user.total / maxParticipation) * 100;
                            const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
                            return (
                                <div key={user.uid} style={{
                                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0',
                                    borderBottom: i < 4 ? '1px dashed #eee' : 'none'
                                }}>
                                    <div style={{
                                        width: '36px', height: '36px',
                                        borderRadius: '50%', background: i < 3 ? '#FFF8E1' : '#f5f5f5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '1.2rem', fontWeight: 700,
                                        color: i < 3 ? '#FFC107' : '#999'
                                    }}>
                                        {i < 3 ? medals[i] : i + 1}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>{user.name}</div>
                                        <div style={{ width: '100%', height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${pct}%`,
                                                height: '100%',
                                                background: i === 0 ? '#E53935' : (i === 1 ? '#9C27B0' : '#1976D2'),
                                                borderRadius: '3px'
                                            }} />
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333' }}>{user.total}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#999' }}>aktivit</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ACTIVITY BREAKDOWN */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>📈 Rozložení aktivit</h3>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', borderRadius: '8px', background: '#FFEBEE' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚩</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#E53935', marginBottom: '0.25rem' }}>{totalEvents}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>Akce</div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', borderRadius: '8px', background: '#F3E5F5' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#9C27B0', marginBottom: '0.25rem' }}>{totalTrainings}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>Školení</div>
                            </div>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '12px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            display: 'flex',
                            background: '#f0f0f0'
                        }}>
                            {totalActivities > 0 && (
                                <>
                                    <div style={{
                                        width: `${(totalEvents / totalActivities) * 100}%`,
                                        background: '#E53935'
                                    }} />
                                    <div style={{
                                        width: `${(totalTrainings / totalActivities) * 100}%`,
                                        background: '#9C27B0'
                                    }} />
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8rem', color: '#666', justifyContent: 'center' }}>
                            <div>
                                <span style={{ color: '#E53935', fontWeight: 600 }}>{totalActivities > 0 ? Math.round((totalEvents / totalActivities) * 100) : 0}%</span> Akce
                            </div>
                            <div>
                                <span style={{ color: '#9C27B0', fontWeight: 600 }}>{totalActivities > 0 ? Math.round((totalTrainings / totalActivities) * 100) : 0}%</span> Školení
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* DETAILED MEMBER CARDS */}
            <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>👥 Detailní přehled členů</h3>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>{users.length} účastníků</span>
                </div>
                <div style={{
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1rem'
                }}>
                    {userStats.map(user => (
                        <div key={user.uid} style={{
                            padding: '1.25rem',
                            borderRadius: '10px',
                            border: '1px solid #e0e0e0',
                            background: 'white',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                            transition: 'transform 0.2s, box-shadow 0.2s'
                        }}
                            onMouseOver={e => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.06)';
                            }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '1rem', color: '#333' }}>
                                {user.name}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    background: '#FFEBEE',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🚩</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#E53935', marginBottom: '0.125rem' }}>{user.events}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#666' }}>Akce</div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    background: '#F3E5F5',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📚</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#9C27B0', marginBottom: '0.125rem' }}>{user.trainings}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#666' }}>Školení</div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    background: '#FFF3E0',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📊</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FF9800', marginBottom: '0.125rem' }}>{user.total}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#666' }}>Celkem</div>
                                </div>
                            </div>

                            {user.latestActivity && (
                                <div style={{
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    background: '#f9f9f9',
                                    borderLeft: '3px solid ' + (user.latestActivity.type === 'event' ? '#E53935' : '#9C27B0')
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: '#777', marginBottom: '0.25rem' }}>
                                        Poslední aktivita
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#333' }}>
                                        {user.latestActivity.type === 'event' ? '🚩' : '📚'} {user.latestActivity.title || user.latestActivity.name}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.125rem' }}>
                                        {new Date(user.latestActivity.date).toLocaleDateString('cs-CZ')}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
