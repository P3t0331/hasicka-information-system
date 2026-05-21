import React from 'react';
import { MONTHS_CZ } from '../../utils/constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartBlock, ChartTooltip, PieLabel } from './ChartComponents';

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

    const getActivityHours = (activity) => {
        if (!activity.time || !activity.timeEnd) return 0;
        const [startH, startM] = activity.time.split(':').map(Number);
        const [endH, endM] = activity.timeEnd.split(':').map(Number);
        if (isNaN(startH) || isNaN(endH)) return 0;
        
        const startMinutes = startH * 60 + (isNaN(startM) ? 0 : startM);
        const endMinutes = endH * 60 + (isNaN(endM) ? 0 : endM);
        let diffMins = endMinutes - startMinutes;
        if (diffMins < 0) {
            diffMins += 24 * 60; // spans midnight
        }
        return diffMins / 60;
    };

    // Calculate statistics for each user
    const userStats = users.map(user => {
        const userEvents = eventsData.filter(e =>
            e.participants?.some(p => p.uid === user.uid)
        );
        const userTrainings = trainingsData.filter(t =>
            t.participants?.some(p => p.uid === user.uid)
        );
        const total = userEvents.length + userTrainings.length;

        const eventsHours = userEvents.reduce((sum, e) => sum + getActivityHours(e), 0);
        const trainingsHours = userTrainings.reduce((sum, t) => sum + getActivityHours(t), 0);
        const totalHours = eventsHours + trainingsHours;

        // Get latest activity
        const allActivities = [
            ...userEvents.map(e => ({ ...e, type: 'event' })),
            ...userTrainings.map(t => ({ ...t, type: 'training' }))
        ].sort((a, b) => b.date.localeCompare(a.date));

        return {
            ...user,
            events: userEvents.length,
            trainings: userTrainings.length,
            eventsHours,
            trainingsHours,
            total,
            totalHours,
            latestActivity: allActivities[0]
        };
    }).sort((a, b) => b.totalHours - a.totalHours || b.total - a.total);

    const totalEvents = eventsData.length;
    const totalTrainings = trainingsData.length;
    const totalActivities = totalEvents + totalTrainings;

    const totalEventsHours = eventsData.reduce((sum, e) => sum + getActivityHours(e), 0);
    const totalTrainingsHours = trainingsData.reduce((sum, t) => sum + getActivityHours(t), 0);
    const totalActivitiesHours = totalEventsHours + totalTrainingsHours;

    const activeParticipants = users.length;
    const avgPerPerson = activeParticipants > 0 ? (totalActivities / activeParticipants).toFixed(1) : 0;
    const avgHoursPerPerson = activeParticipants > 0 ? (totalActivitiesHours / activeParticipants) : 0;
    const maxParticipationHours = Math.max(...userStats.map(u => u.totalHours), 1);

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
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        {totalEvents} <span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.85 }}>({totalEventsHours.toFixed(1).replace('.0', '')}h)</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Akce celkem (odpracované h)</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(156, 39, 176, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📚</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        {totalTrainings} <span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.85 }}>({totalTrainingsHours.toFixed(1).replace('.0', '')}h)</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Školení celkem (odškolené h)</div>
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
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                        {avgPerPerson} <span style={{ fontSize: '1.1rem', fontWeight: 500, opacity: 0.85 }}>({avgHoursPerPerson.toFixed(1).replace('.0', '')}h)</span>
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Průměr na osobu (aktivity / h)</div>
                </div>
            </div>

            {/* Charts Section */}
            {totalActivitiesHours > 0 && (() => {
                const pieData = [
                    { name: 'Akce', value: parseFloat(totalEventsHours.toFixed(1)), color: '#E53935' },
                    { name: 'Školení', value: parseFloat(totalTrainingsHours.toFixed(1)), color: '#9C27B0' },
                ].filter(d => d.value > 0);

                const memberBarData = userStats.slice(0, 8).map(u => ({
                    name: u.name.split(' ')[0],
                    Akce: parseFloat(u.eventsHours.toFixed(1)),
                    Školení: parseFloat(u.trainingsHours.toFixed(1)),
                }));

                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <ChartBlock title="🍩 Akce vs Školení (hodiny)" height={300}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="45%" innerRadius={65} outerRadius={105} dataKey="value" nameKey="name" labelLine={false} label={PieLabel}>
                                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Legend iconType="circle" iconSize={10} formatter={(value) => <span style={{ fontSize: '0.8rem', color: '#555' }}>{value}</span>} />
                                    <Tooltip content={<ChartTooltip unit="h" />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartBlock>

                        {memberBarData.some(d => d.Akce > 0 || d.Školení > 0) && (
                            <ChartBlock title="👥 Hodiny členů (top 8)" height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={memberBarData} barSize={16} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11 }} unit="h" width={38} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip unit="h" />} cursor={{ fill: '#f5f5f5' }} />
                                        <Legend iconType="square" iconSize={10} formatter={(value) => <span style={{ fontSize: '0.8rem', color: '#555' }}>{value}</span>} />
                                        <Bar dataKey="Akce" stackId="a" fill="#E53935" />
                                        <Bar dataKey="Školení" stackId="a" fill="#9C27B0" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartBlock>
                        )}
                    </div>
                );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                {/* TOP 5 LEADERBOARD */}
                <div className="card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>🏆 Top 5 Nejaktivnějších (podle hodin)</h3>
                    </div>
                    <div style={{ padding: '0.5rem 1rem' }}>
                        {userStats.slice(0, 5).map((user, i) => {
                            const pct = (user.totalHours / maxParticipationHours) * 100;
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
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333' }}>{user.totalHours.toFixed(1).replace('.0', '')}h</div>
                                        <div style={{ fontSize: '0.65rem', color: '#999' }}>{user.total} aktivit</div>
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
                        {/* Counts breakdown */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: '8px', background: '#FFEBEE' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>🚩</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#E53935', marginBottom: '0.1rem' }}>
                                    {totalEvents} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#666' }}>({totalEventsHours.toFixed(1).replace('.0', '')}h)</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>Akce</div>
                            </div>
                            <div style={{ flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: '8px', background: '#F3E5F5' }}>
                                <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>📚</div>
                                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#9C27B0', marginBottom: '0.1rem' }}>
                                    {totalTrainings} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#666' }}>({totalTrainingsHours.toFixed(1).replace('.0', '')}h)</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>Školení</div>
                            </div>
                        </div>

                        {/* Counts breakdown bar */}
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#777', marginBottom: '4px' }}>Rozložení podle počtu:</div>
                        <div style={{
                            width: '100%',
                            height: '10px',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            display: 'flex',
                            background: '#f0f0f0',
                            marginBottom: '1rem'
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

                        {/* Hours breakdown bar */}
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#777', marginBottom: '4px' }}>Rozložení podle hodin:</div>
                        <div style={{
                            width: '100%',
                            height: '10px',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            display: 'flex',
                            background: '#f0f0f0'
                        }}>
                            {totalActivitiesHours > 0 && (
                                <>
                                    <div style={{
                                        width: `${(totalEventsHours / totalActivitiesHours) * 100}%`,
                                        background: '#E53935'
                                    }} />
                                    <div style={{
                                        width: `${(totalTrainingsHours / totalActivitiesHours) * 100}%`,
                                        background: '#9C27B0'
                                    }} />
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#666', justifyContent: 'center' }}>
                            <div>
                                <span style={{ color: '#E53935', fontWeight: 600 }}>{totalActivitiesHours > 0 ? Math.round((totalEventsHours / totalActivitiesHours) * 100) : 0}%</span> Akce
                            </div>
                            <div>
                                <span style={{ color: '#9C27B0', fontWeight: 600 }}>{totalActivitiesHours > 0 ? Math.round((totalTrainingsHours / totalActivitiesHours) * 100) : 0}%</span> Školení
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

                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                <div style={{
                                    flex: 1,
                                    padding: '0.5rem 0.25rem',
                                    borderRadius: '8px',
                                    background: '#FFEBEE',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>🚩</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#E53935', marginBottom: '0.125rem' }}>{user.events}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#c62828' }}>{user.eventsHours.toFixed(1).replace('.0', '')}h</div>
                                    <div style={{ fontSize: '0.65rem', color: '#777' }}>Akce</div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '0.5rem 0.25rem',
                                    borderRadius: '8px',
                                    background: '#F3E5F5',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>📚</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#9C27B0', marginBottom: '0.125rem' }}>{user.trainings}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#7b1fa2' }}>{user.trainingsHours.toFixed(1).replace('.0', '')}h</div>
                                    <div style={{ fontSize: '0.65rem', color: '#777' }}>Školení</div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '0.5rem 0.25rem',
                                    borderRadius: '8px',
                                    background: '#FFF3E0',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>📊</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FF9800', marginBottom: '0.125rem' }}>{user.total}</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef6c00' }}>{user.totalHours.toFixed(1).replace('.0', '')}h</div>
                                    <div style={{ fontSize: '0.65rem', color: '#777' }}>Celkem</div>
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
