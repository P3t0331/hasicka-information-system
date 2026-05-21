import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { ChartBlock, ChartTooltip } from './ChartComponents';

const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

export default function AbsencesTab({ absencesData, currentDate }) {
    const today = new Date();
    const monthYear = currentDate.getFullYear();
    const monthIndex = currentDate.getMonth();
    const monthStart = new Date(monthYear, monthIndex, 1);
    const monthEnd = new Date(monthYear, monthIndex + 1, 0);

    // Get all absent users with their stats
    const userMap = new Map();
    absencesData.forEach(absence => {
        if (!userMap.has(absence.uid)) {
            userMap.set(absence.uid, absence.userName || 'Neznámý');
        }
    });
    const users = Array.from(userMap, ([uid, name]) => ({ uid, name }))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (users.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
                <p>Žádné absence tento měsíc</p>
            </div>
        );
    }

    // Calculate stats for each user
    const userStats = users.map(user => {
        const userAbsences = absencesData.filter(a => a.uid === user.uid);

        const daysAbsent = userAbsences.reduce((total, absence) => {
            const start = new Date(Math.max(new Date(absence.startDate), monthStart));
            const end = new Date(Math.min(new Date(absence.endDate), monthEnd, today));
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            return total + Math.max(0, days);
        }, 0);

        const latestAbsence = [...userAbsences].sort((a, b) =>
            b.startDate.localeCompare(a.startDate)
        )[0];

        // Check for currently active absences
        const activeAbsence = userAbsences.find(a => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            return start <= today && end >= today;
        });

        return {
            ...user,
            absenceCount: userAbsences.length,
            daysAbsent,
            latestAbsence,
            activeAbsence,
            absences: userAbsences
        };
    }).sort((a, b) => b.daysAbsent - a.daysAbsent);

    const totalAbsences = absencesData.length;
    const totalDays = userStats.reduce((sum, u) => sum + u.daysAbsent, 0);
    const avgDaysPerPerson = users.length > 0 ? (totalDays / users.length).toFixed(1) : 0;
    const activeAbsencesCount = userStats.filter(u => u.activeAbsence).length;
    const chartData = userStats.map(u => ({
        name: u.name.split(' ')[0],
        'Dní absence': u.daysAbsent,
        active: !!u.activeAbsence
    }));

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
                    background: 'linear-gradient(135deg, #757575, #616161)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(117, 117, 117, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚫</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{totalAbsences}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Celkový počet absencí</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #F57C00, #E64A19)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(245, 124, 0, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📅</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{totalDays}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Dní celkem</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #D32F2F, #C62828)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(211, 47, 47, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{activeAbsencesCount}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Aktivní absence</div>
                </div>

                <div className="card" style={{
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, #1976D2, #1565C0)',
                    color: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' }}>{avgDaysPerPerson}</div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Průměrný počet dní</div>
                </div>
            </div>

            {chartData.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <ChartBlock title="📉 Absence členů (dny)" height={Math.max(200, chartData.length * 36 + 40)}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                layout="vertical"
                                margin={{ top: 5, right: 24, left: 60, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                                <Tooltip content={<ChartTooltip unit=" dní" />} />
                                <Bar dataKey="Dní absence" radius={[0, 4, 4, 0]}>
                                    {chartData.map((entry, i) => (
                                        <Cell key={i} fill={entry.active ? '#D32F2F' : '#F57C00'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartBlock>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                {/* ACTIVE ABSENCES */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>⚠️ Aktivní absence</h3>
                    </div>
                    {activeAbsencesCount > 0 ? (
                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {userStats.filter(u => u.activeAbsence).map(user => (
                                <div key={user.uid} style={{
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    background: '#FFF3E0',
                                    borderLeft: '4px solid #FF9800'
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem', color: '#333' }}>
                                        {user.name}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                                        <strong>{user.activeAbsence.reason}</strong>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#777' }}>
                                        {new Date(user.activeAbsence.startDate).toLocaleDateString('cs-CZ')}
                                        {' – '}
                                        {new Date(user.activeAbsence.endDate).toLocaleDateString('cs-CZ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                            <div>Žádné aktivní absence</div>
                        </div>
                    )}
                </div>
            </div>

            {/* DETAILED MEMBER CARDS */}
            <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>👥 Detailní přehled absencí</h3>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>{users.length} lidí</span>
                </div>
                <div style={{
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1rem'
                }}>
                    {userStats.map(user => (
                        <div key={user.uid} style={{
                            padding: '1.25rem',
                            borderRadius: '10px',
                            border: '2px solid' + (user.activeAbsence ? ' #FF9800' : ' #e0e0e0'),
                            background: user.activeAbsence ? '#FFF8E1' : 'white',
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#333' }}>
                                    {user.name}
                                </div>
                                {user.activeAbsence && (
                                    <span style={{
                                        fontSize: '0.7rem',
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        background: '#FF9800',
                                        color: 'white',
                                        fontWeight: 600
                                    }}>
                                        AKTIVNÍ
                                    </span>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    background: '#F5F5F5',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🚫</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#757575', marginBottom: '0.125rem' }}>{user.absenceCount}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#666' }}>Absencí</div>
                                </div>
                                <div style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    background: '#FFE0B2',
                                    textAlign: 'center'
                                }}>
                                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📅</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F57C00', marginBottom: '0.125rem' }}>{user.daysAbsent}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#666' }}>Dní</div>
                                </div>
                            </div>

                            {user.latestAbsence && (
                                <div style={{
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    background: user.activeAbsence === user.latestAbsence ? '#FFE0B2' : '#f9f9f9',
                                    borderLeft: '3px solid ' + (user.activeAbsence === user.latestAbsence ? '#FF9800' : '#757575')
                                }}>
                                    <div style={{ fontSize: '0.7rem', color: '#777', marginBottom: '0.25rem' }}>
                                        {user.activeAbsence === user.latestAbsence ? 'Probíhající absence' : 'Poslední absence'}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#333', marginBottom: '0.25rem' }}>
                                        {user.latestAbsence.reason}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: '#666' }}>
                                        {new Date(user.latestAbsence.startDate).toLocaleDateString('cs-CZ')}
                                        {' – '}
                                        {new Date(user.latestAbsence.endDate).toLocaleDateString('cs-CZ')}
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
