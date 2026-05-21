import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logAction } from '../../utils/logger';
import StatCard from './StatCard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { ChartBlock, ChartTooltip, PieLabel } from './ChartComponents';

const DAYS_CZ = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const MONTHS_CZ = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

const DEFAULT_NIGHT_HOURS = 11;
const DEFAULT_DAY_HOURS = 8;

export default function ShiftsTab({
    shiftsData,
    currentDate,
    currentDocId,
    isAdmin,
    currentUser,
    userData
}) {
    const [editingCell, setEditingCell] = useState(null);

    // Get all days in month
    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysCount = new Date(year, month + 1, 0).getDate();
        const result = [];
        for (let i = 1; i <= daysCount; i++) {
            const d = new Date(year, month, i);
            result.push({
                date: i,
                dayName: DAYS_CZ[d.getDay()],
                isWeekend: d.getDay() === 0 || d.getDay() === 6
            });
        }
        return result;
    };

    const days = getDaysInMonth();

    // Collect all unique users from shifts this month
    const getAllUsers = () => {
        const users = new Map();
        Object.values(shiftsData).forEach(dayData => {
            ['dayShift', 'nightShift', 'zalohaStaz'].forEach(shiftType => {
                const shift = dayData[shiftType] || {};
                Object.values(shift).forEach(user => {
                    if (user && user.uid) { // this excludes config since it has no uid
                        users.set(user.uid, user.name);
                    }
                });
            });
        });
        return Array.from(users, ([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
    };

    const users = getAllUsers();

    // Get split hours for a user on a specific day
    const getSplitHoursForUser = (day, uid) => {
        try {
            const dayData = shiftsData[day] || {};
            const h = dayData.hours ? dayData.hours[uid] : null;
            let explicitDay = undefined;
            let explicitNight = undefined;

            if (h) {
                if (typeof h.day === 'number') explicitDay = h.day;
                if (typeof h.night === 'number') explicitNight = h.night;
            }

            const nightShift = dayData.nightShift || {};
            const hasNightShift = Object.values(nightShift).some(u => u && u.uid === uid);
            const dayShift = dayData.dayShift || {};
            const hasDayShift = Object.values(dayShift).some(u => u && u.uid === uid);
            
            const zalohaStaz = dayData.zalohaStaz || {};
            const hasZaloha = Object.values(zalohaStaz).some(u => u && u.uid === uid);

            const daySlot = hasDayShift ? Object.values(dayShift).find(u => u && u.uid === uid) : null;
            const nightSlot = hasNightShift ? Object.values(nightShift).find(u => u && u.uid === uid) : null;

            const calcCustomHours = (slot, defaultHours) => {
                if (slot?.timeFrom && slot?.timeTo) {
                    const [h1, m1] = slot.timeFrom.split(':').map(Number);
                    const [h2, m2] = slot.timeTo.split(':').map(Number);
                    let diff = (h2 + m2/60) - (h1 + m1/60);
                    if (diff < 0) diff += 24;
                    return Math.round(diff * 100) / 100;
                }
                return defaultHours;
            };

            const dayHours = explicitDay !== undefined ? explicitDay : (hasDayShift ? calcCustomHours(daySlot, DEFAULT_DAY_HOURS) : 0);
            const nightHours = explicitNight !== undefined ? explicitNight : (hasNightShift ? calcCustomHours(nightSlot, DEFAULT_NIGHT_HOURS) : 0);
            
            let zalohaHours = 0;
            if (hasZaloha) {
                let zHours = 12;
                if (zalohaStaz.config?.timeFrom && zalohaStaz.config?.timeTo) {
                    const [h1, m1] = zalohaStaz.config.timeFrom.split(':').map(Number);
                    const [h2, m2] = zalohaStaz.config.timeTo.split(':').map(Number);
                    let diff = (h2 + m2/60) - (h1 + m1/60);
                    if (diff < 0) diff += 24; // spans midnight
                    zHours = diff;
                }
                zalohaHours = zHours;
            }

            return {
                day: dayHours,
                night: nightHours,
                zaloha: zalohaHours,
                total: dayHours + nightHours, // zaloha not included in regular total
                isExplicit: !!h
            };
        } catch (err) {
            console.error("Error calculating split hours:", err);
            return { day: 0, night: 0, zaloha: 0, total: 0, isExplicit: false };
        }
    };

    const getHoursForUser = (day, uid) => {
        return getSplitHoursForUser(day, uid).total;
    };

    const getShiftDescription = (day) => {
        const dayData = shiftsData[day] || {};
        const parts = [];

        if (dayData.nightShift && Object.keys(dayData.nightShift).length > 0) {
            const crew = Object.values(dayData.nightShift).map(u => u?.name?.split(' ')[0]).filter(Boolean).join(', ');
            if (crew) parts.push(`Noční: ${crew}`);
        }
        if (dayData.dayShift && Object.keys(dayData.dayShift).length > 0) {
            const crew = Object.values(dayData.dayShift).map(u => u?.name?.split(' ')[0]).filter(Boolean).join(', ');
            if (crew) parts.push(`Denní: ${crew}`);
        }
        if (dayData.zalohaStaz) {
            const crew = Object.values(dayData.zalohaStaz).filter(u => u && u.uid).map(u => u?.name?.split(' ')[0]).filter(Boolean).join(', ');
            if (crew) parts.push(`Stáž: ${crew}`);
        }

        return parts.join(' | ') || '-';
    };

    const isDateInFuture = (day) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const checkDate = new Date(year, month, day);
        checkDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return checkDate > today;
    };

    const getTotalHoursForUser = (uid) => {
        return days.reduce((sum, day) => {
            if (isDateInFuture(day.date)) return sum;
            return sum + getHoursForUser(day.date, uid);
        }, 0);
    };

    const getSplitTotalHoursForUser = (uid) => {
        return days.reduce((acc, day) => {
            if (isDateInFuture(day.date)) return acc;
            const split = getSplitHoursForUser(day.date, uid);
            return { day: acc.day + split.day, night: acc.night + split.night, zaloha: acc.zaloha + split.zaloha, total: acc.total + split.total };
        }, { day: 0, night: 0, zaloha: 0, total: 0 });
    };

    const getTotalHoursForDay = (day) => {
        return users.reduce((sum, user) => sum + getHoursForUser(day, user.uid), 0);
    };
    
    const getTotalZalohaHoursForDay = (day) => {
        return users.reduce((sum, user) => sum + getSplitHoursForUser(day, user.uid).zaloha, 0);
    };

    const getTotalDayHoursForDay = (day) => {
        return users.reduce((sum, user) => sum + getSplitHoursForUser(day, user.uid).day, 0);
    };

    const getTotalNightHoursForDay = (day) => {
        return users.reduce((sum, user) => sum + getSplitHoursForUser(day, user.uid).night, 0);
    };

    const getGrandTotal = () => {
        return users.reduce((sum, user) => sum + getTotalHoursForUser(user.uid), 0);
    };
    
    const getGrandZalohaTotal = () => {
        return users.reduce((sum, user) => sum + getSplitTotalHoursForUser(user.uid).zaloha, 0);
    };

    const getGrandSplitTotal = () => {
        return users.reduce((acc, user) => {
            const split = getSplitTotalHoursForUser(user.uid);
            return { day: acc.day + split.day, night: acc.night + split.night, zaloha: acc.zaloha + split.zaloha, total: acc.total + split.total };
        }, { day: 0, night: 0, zaloha: 0, total: 0 });
    };

    const handleHourEdit = async (day, uid, type, value) => {
        try {
            const current = getSplitHoursForUser(day, uid);
            const update = { day: current.day, night: current.night };

            if (type === 'day') {
                update.day = parseInt(value) || 0;
            } else if (type === 'night') {
                update.night = parseInt(value) || 0;
            }

            const docRef = doc(db, 'shifts', currentDocId);
            await setDoc(docRef, {
                days: {
                    [day]: {
                        hours: {
                            [uid]: update
                        }
                    }
                }
            }, { merge: true });

            const targetUser = users.find(u => u.uid === uid);
            logAction(db, currentUser.uid, `${userData.firstName} ${userData.lastName}`,
                'ADMIN_UPDATED_SHIFT_HOURS', 'shifts',
                `Upravil hodiny uživateli ${targetUser?.name || uid} na den ${day}. ${MONTHS_CZ[currentDate.getMonth()]} (Denní: ${update.day}h, Noční: ${update.night}h)`);
        } catch (err) {
            console.error("Error updating hours:", err);
        }
    };



    const maxUserHours = Math.max(...users.map(u => getTotalHoursForUser(u.uid)), 1);

    return (
        <>
            {/* KPI Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard
                    icon="⏱️"
                    value={getGrandTotal().toString()}
                    label="Celkem hodin"
                    sublabel="Tento měsíc"
                    color="#D32F2F"
                    bg="rgba(211, 47, 47, 0.08)"
                />
                <StatCard
                    icon="👥"
                    value={users.filter(u => getTotalHoursForUser(u.uid) > 0).length.toString()}
                    label="Aktivních členů"
                    sublabel="S odpracovanými hodinami"
                    color="#1976D2"
                    bg="rgba(25, 118, 210, 0.08)"
                />
                <StatCard
                    icon="📊"
                    value={(users.filter(u => getTotalHoursForUser(u.uid) > 0).length > 0 ? Math.round(getGrandTotal() / users.filter(u => getTotalHoursForUser(u.uid) > 0).length) : 0).toString()}
                    label="Průměr na člena"
                    sublabel="Průměrný počet hodin"
                    color="#388E3C"
                    bg="rgba(56, 142, 60, 0.08)"
                />
                <StatCard
                    icon="📅"
                    value={days.filter(d => getTotalHoursForDay(d.date) > 0).length.toString()}
                    label="Odsloužených dnů"
                    sublabel="Dny s alespoň 1 službou"
                    color="#F57C00"
                    bg="rgba(245, 124, 0, 0.08)"
                />
            </div>

            {/* Charts Section */}
            {(() => {
                const splitTotal = getGrandSplitTotal();
                const donutData = [
                    { name: 'Denní', value: splitTotal.day, color: '#F57C00' },
                    { name: 'Noční', value: splitTotal.night, color: '#3949AB' },
                    { name: 'Záloha', value: splitTotal.zaloha, color: '#1565C0' },
                ].filter(d => d.value > 0);

                const dailyChartData = days
                    .filter(d => !isDateInFuture(d.date))
                    .map(d => ({
                        den: String(d.date),
                        Denní: getTotalDayHoursForDay(d.date),
                        Noční: getTotalNightHoursForDay(d.date),
                        Záloha: getTotalZalohaHoursForDay(d.date),
                    }))
                    .filter(d => d.Denní > 0 || d.Noční > 0 || d.Záloha > 0);

                if (donutData.length === 0) return null;
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                        <ChartBlock title="🍩 Rozdělení hodin" height={300}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={donutData} cx="50%" cy="45%" innerRadius={65} outerRadius={105} dataKey="value" nameKey="name" labelLine={false} label={PieLabel}>
                                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Legend iconType="circle" iconSize={10} formatter={(value) => <span style={{ fontSize: '0.8rem', color: '#555' }}>{value}</span>} />
                                    <Tooltip content={<ChartTooltip unit="h" />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartBlock>

                        {dailyChartData.length > 0 && (
                            <ChartBlock title="📅 Hodiny po dnech" height={300}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyChartData} barSize={14} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                        <XAxis dataKey="den" tick={{ fontSize: 11 }} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11 }} unit="h" width={38} tickLine={false} axisLine={false} />
                                        <Tooltip content={<ChartTooltip unit="h" />} cursor={{ fill: '#f5f5f5' }} />
                                        <Legend iconType="square" iconSize={10} formatter={(value) => <span style={{ fontSize: '0.8rem', color: '#555' }}>{value}</span>} />
                                        <Bar dataKey="Denní" stackId="a" fill="#F57C00" />
                                        <Bar dataKey="Noční" stackId="a" fill="#3949AB" />
                                        <Bar dataKey="Záloha" stackId="a" fill="#1565C0" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartBlock>
                        )}
                    </div>
                );
            })()}

            {/* Detailed Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                {/* LEADERBOARD */}
                <div className="card" style={{ padding: '0', overflow: 'hidden', height: 'fit-content' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>🏆 Top 5 Hasičů</h3>
                    </div>
                    <div style={{ padding: '0.5rem 1rem' }}>
                        {users
                            .filter(user => getTotalHoursForUser(user.uid) > 0)
                            .sort((a, b) => getTotalHoursForUser(b.uid) - getTotalHoursForUser(a.uid))
                            .slice(0, 5)
                            .map((user, i) => {
                                const hours = getTotalHoursForUser(user.uid);
                                const pct = (hours / (maxUserHours || 1)) * 100;
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
                                                <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? '#D32F2F' : (i === 1 ? '#F57C00' : '#1976D2'), borderRadius: '3px' }} />
                                            </div>
                                        </div>

                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#333' }}>{hours}h</div>
                                    </div>
                                );
                            })}
                        {users.every(u => getTotalHoursForUser(u.uid) === 0) && (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>Zatím nejsou žádná data</div>
                        )}
                    </div>
                </div>

                {/* MEMBER LIST */}
                <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>👥 Přehled členů</h3>
                    </div>
                    <div style={{
                        padding: '1rem',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '1rem',
                        maxHeight: '500px',
                        overflowY: 'auto'
                    }}>
                        {users
                            .filter(user => getTotalHoursForUser(user.uid) > 0)
                            .sort((a, b) => getTotalHoursForUser(b.uid) - getTotalHoursForUser(a.uid))
                            .map(user => {
                                const split = getSplitTotalHoursForUser(user.uid);
                                const isMe = user.uid === currentUser?.uid;
                                const hours = getTotalHoursForUser(user.uid);

                                return (
                                    <div key={user.uid} style={{
                                        padding: '1rem', borderRadius: '10px',
                                        border: isMe ? '2px solid #81C784' : '1px solid #e0e0e0',
                                        background: isMe ? '#F1F8E9' : 'white',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: '#333' }}>{isMe && '⭐ '}{user.name}</span>
                                            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#333' }}>{hours}h</span>
                                        </div>

                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            {split.day > 0 && (
                                                <span style={{
                                                    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                                                    background: '#FFF3E0', color: '#E65100', fontWeight: 600
                                                }}>
                                                    ☀️ {split.day}
                                                </span>
                                            )}
                                            {split.night > 0 && (
                                                <span style={{
                                                    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                                                    background: '#E8EAF6', color: '#3949AB', fontWeight: 600
                                                }}>
                                                    🌙 {split.night}
                                                </span>
                                            )}
                                            {split.zaloha > 0 && (
                                                <span style={{
                                                    fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px',
                                                    background: '#E3F2FD', color: '#1565C0', fontWeight: 600
                                                }}>
                                                    🛡️ {split.zaloha}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* Separate Stáž/Záloha Members List */}
            <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '3rem' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: 'linear-gradient(135deg, #1976D2, #0D47A1)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white' }}>🛡️ Přehled členů na Stážích/Zálohách</h3>
                </div>
                <div style={{
                    padding: '1rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1rem',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {users
                        .filter(user => getSplitTotalHoursForUser(user.uid).zaloha > 0)
                        .sort((a, b) => getSplitTotalHoursForUser(b.uid).zaloha - getSplitTotalHoursForUser(a.uid).zaloha)
                        .map(user => {
                            const zalohaHours = getSplitTotalHoursForUser(user.uid).zaloha;
                            const isMe = user.uid === currentUser?.uid;

                            return (
                                <div key={'zaloha-' + user.uid} style={{
                                    padding: '1rem', borderRadius: '10px',
                                    border: isMe ? '2px solid #81C784' : '1px solid #BBDEFB',
                                    background: isMe ? '#F1F8E9' : '#F8BBD0',
                                    backgroundColor: isMe ? '#F1F8E9' : '#f5fafe',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: 600, color: '#333' }}>{isMe && '⭐ '}{user.name}</span>
                                        <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#1565C0' }}>{zalohaHours}h</span>
                                    </div>
                                </div>
                            );
                        })}
                    {users.every(u => getSplitTotalHoursForUser(u.uid).zaloha === 0) && (
                        <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: '#999' }}>Zatím nejsou žádná data</div>
                    )}
                </div>
            </div>

            {/* Full Data Table */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>📅 Denní záznamy</h3>
                    <span style={{ fontSize: '0.85rem', color: '#777' }}>Detailní rozpis hodin</span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                            <tr>
                                <th style={{ padding: '1rem', textAlign: 'left', color: '#555', fontWeight: 600 }}>Datum</th>
                                <th style={{ padding: '1rem', textAlign: 'left', color: '#555', fontWeight: 600 }}>Složení směny</th>
                                <th style={{ padding: '1rem', textAlign: 'center', color: '#555', fontWeight: 600 }}>Celkem hodin</th>
                                {isAdmin && <th style={{ padding: '1rem', textAlign: 'center', color: '#555', fontWeight: 600 }}>Akce</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {days.map(day => {
                                const inFuture = isDateInFuture(day.date);
                                const totalHours = !inFuture ? getTotalHoursForDay(day.date) : 0;
                                const desc = !inFuture ? getShiftDescription(day.date) : '';
                                const hasShift = desc !== '-' && desc !== '';

                                return (
                                    <tr
                                        key={day.date}
                                        style={{
                                            background: day.isWeekend ? '#fafafa' : 'white',
                                            borderBottom: '1px solid #eee'
                                        }}
                                    >
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500, opacity: inFuture ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                                            <span style={{ display: 'inline-block', width: '25px', textAlign: 'center', marginRight: '4px', fontWeight: 700, color: day.isWeekend ? '#e53935' : '#333' }}>
                                                {day.date}.
                                            </span>
                                            <span style={{ textTransform: 'capitalize', color: '#777' }}>{day.dayName}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {inFuture ? (
                                                <span style={{ fontSize: '0.8rem', color: '#999', fontStyle: 'italic' }}>Budoucí datum</span>
                                            ) : (
                                                desc !== '-' ? <span style={{ color: '#333' }}>{desc}</span> : <span style={{ color: '#ccc' }}>-</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                            {totalHours > 0 || getTotalZalohaHoursForDay(day.date) > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                    {totalHours > 0 && (
                                                        <span style={{ fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem' }}>
                                                            {totalHours}h
                                                        </span>
                                                    )}
                                                    {getTotalZalohaHoursForDay(day.date) > 0 && (
                                                        <span style={{ fontWeight: 700, color: '#1565C0', background: '#E3F2FD', padding: '2px 8px', borderRadius: '12px', fontSize: '0.85rem', marginTop: totalHours > 0 ? '2px' : '0' }}>
                                                            🛡️ {getTotalZalohaHoursForDay(day.date)}h
                                                        </span>
                                                    )}
                                                </div>
                                            ) : '-'}
                                        </td>
                                        {isAdmin && (
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                {hasShift && (
                                                    <button
                                                        onClick={() => setEditingCell(day.date)}
                                                        style={{
                                                            background: 'white', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontSize: '0.9rem'
                                                        }}
                                                        title="Upravit hodiny"
                                                    >
                                                        ✏️
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: '#37474F', color: 'white' }}>
                                <td style={{ padding: '1rem', fontWeight: 700 }} colSpan={2}>
                                    MĚSÍČNÍ SOUČET
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{getGrandTotal()}h</div>
                                    <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                        (☀️ {getGrandSplitTotal().day} + 🌙 {getGrandSplitTotal().night})
                                    </div>
                                    {getGrandZalohaTotal() > 0 && (
                                        <div style={{ fontSize: '0.85rem', color: '#90CAF9', fontWeight: 600, marginTop: '0.2rem' }}>
                                            + {getGrandZalohaTotal()}h (Stáž)
                                        </div>
                                    )}
                                </td>
                                {isAdmin && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {editingCell && (
                <EditHoursModal
                    day={editingCell}
                    onClose={() => setEditingCell(null)}
                    shiftsData={shiftsData}
                    currentDate={currentDate}
                    users={users}
                    getSplitHoursForUser={getSplitHoursForUser}
                    handleHourEdit={handleHourEdit}
                />
            )}
        </>
    );
}

// Edit Modal Component declared outside of render to prevent recreation
const EditHoursModal = ({
    day,
    onClose,
    shiftsData,
    currentDate,
    users,
    getSplitHoursForUser,
    handleHourEdit
}) => {
    const dayData = shiftsData[day] || {};
    const usersMap = new Map();

    try {
        ['dayShift', 'nightShift'].forEach(shiftType => {
            const shift = dayData[shiftType] || {};
            Object.keys(shift).forEach(slot => {
                const user = shift[slot];
                if (user && user.uid) {
                    if (!usersMap.has(user.uid)) {
                        usersMap.set(user.uid, { ...user, shifts: [shiftType] });
                    } else {
                        const existing = usersMap.get(user.uid);
                        if (!existing.shifts.includes(shiftType)) {
                            existing.shifts.push(shiftType);
                        }
                    }
                }
            });
        });

        if (dayData.hours) {
            Object.keys(dayData.hours).forEach(uid => {
                if (!usersMap.has(uid)) {
                    const userFromList = users.find(u => u.uid === uid);
                    const name = userFromList ? userFromList.name : 'Neznámý uživatel';
                    usersMap.set(uid, { uid, name, shifts: [] });
                }
            });
        }
    } catch (err) {
        console.error("Error processing modal users:", err);
    }

    const uniqueUsers = Array.from(usersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={onClose}>
            <div style={{
                background: 'white', padding: '1.5rem', borderRadius: '8px', width: '90%', maxWidth: '600px'
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ margin: '0 0 1rem 0' }}>Upravit hodiny - {day}. {MONTHS_CZ[currentDate.getMonth()]}</h3>

                {uniqueUsers.length === 0 ? (
                    <p>Žádné směny v tento den.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto' }}>
                        {uniqueUsers.map(user => {
                            const split = getSplitHoursForUser(day, user.uid);
                            const hasDay = user.shifts.includes('dayShift');
                            const hasNight = user.shifts.includes('nightShift');

                            return (
                                <div key={user.uid} style={{ padding: '0.75rem', background: '#f5f5f5', borderRadius: '6px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '1.1rem' }}>{user.name}</div>

                                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                        {/* Night Control */}
                                        <div style={{ flex: 1, minWidth: '220px', opacity: hasNight ? 1 : 0.6 }}>
                                            <div style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                🌙 Noční sm. {(!hasNight && split.night === 0) && '(neobsazeno)'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={split.night <= 0}
                                                    onClick={() => handleHourEdit(day, user.uid, 'night', Math.max(0, split.night - 1))}
                                                >-</button>
                                                <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.1rem' }}>{split.night}h</span>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={!hasNight}
                                                    title={!hasNight ? "Nelze přidat hodiny bez směny" : ""}
                                                    onClick={() => handleHourEdit(day, user.uid, 'night', split.night + 1)}
                                                >+</button>
                                            </div>
                                        </div>

                                        {/* Day Control */}
                                        <div style={{ flex: 1, minWidth: '220px', opacity: hasDay ? 1 : 0.6 }}>
                                            <div style={{ fontSize: '0.75rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                ☀️ Denní sm. {(!hasDay && split.day === 0) && '(neobsazeno)'}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={split.day <= 0}
                                                    onClick={() => handleHourEdit(day, user.uid, 'day', Math.max(0, split.day - 1))}
                                                >-</button>
                                                <span style={{ fontWeight: 700, minWidth: '30px', textAlign: 'center', fontSize: '1.1rem' }}>{split.day}h</span>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={!hasDay}
                                                    title={!hasDay ? "Nelze přidat hodiny bez změny" : ""}
                                                    onClick={() => handleHourEdit(day, user.uid, 'day', split.day + 1)}
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                    <button className="btn btn-primary" onClick={onClose}>Hotovo</button>
                </div>
            </div>
        </div>
    );
};
