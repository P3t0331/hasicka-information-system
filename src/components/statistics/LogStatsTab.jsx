import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { MONTHS_CZ } from '../../utils/constants';
import { ChartBlock, ChartTooltip } from './ChartComponents';

export default function LogStatsTab({ entries, currentDate, accent, emoji, label }) {
    const monthIdx = currentDate.getMonth();
    const year = currentDate.getFullYear();

    const userStats = useMemo(() => {
        const map = new Map();
        entries.forEach(e => {
            const hours = Number(e.hours) || 0;
            const participants = e.participants || [];
            participants.forEach(p => {
                if (!map.has(p.uid)) {
                    map.set(p.uid, { uid: p.uid, name: p.name, count: 0, hours: 0 });
                }
                const u = map.get(p.uid);
                u.count += 1;
                u.hours += hours;
            });
        });
        return Array.from(map.values()).sort((a, b) => b.hours - a.hours || b.count - a.count);
    }, [entries]);

    const totals = useMemo(() => {
        return entries.reduce((acc, e) => {
            const hours = Number(e.hours) || 0;
            const people = Number(e.peopleCount) || 0;
            return {
                hours: acc.hours + hours * people,
                people: acc.people + people,
                count: acc.count + 1
            };
        }, { hours: 0, people: 0, count: 0 });
    }, [entries]);

    const dailyData = useMemo(() => {
        const map = new Map();
        entries.forEach(e => {
            if (!e.date) return;
            const ph = e.personHoursOverride != null
                ? Number(e.personHoursOverride)
                : (Number(e.hours) || 0) * (Number(e.peopleCount) || 0);
            map.set(e.date, (map.get(e.date) || 0) + ph);
        });
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, ph]) => ({
                date: date.slice(8),
                'Osobohodiny': Math.round(ph * 10) / 10
            }));
    }, [entries]);

    const maxUserHours = Math.max(...userStats.map(u => u.hours), 1);
    const topContributor = userStats[0];

    if (entries.length === 0 && totals.count === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <p>Žádné záznamy {label} v {MONTHS_CZ[monthIdx]} {year}.</p>
            </div>
        );
    }

    return (
        <>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <KpiCard
                    icon="⏱️"
                    value={totals.hours.toFixed(2).replace(/\.?0+$/, '')}
                    suffix="h"
                    label="Odpracováno (osobohodin)"
                    gradient={`linear-gradient(135deg, ${accent.from}, ${accent.to})`}
                />
                <KpiCard
                    icon="📋"
                    value={totals.count}
                    label="Počet záznamů"
                    gradient="linear-gradient(135deg, var(--info), var(--info-text))"
                />
                <KpiCard
                    icon="👥"
                    value={totals.people}
                    label="Celkem účastí"
                    gradient="linear-gradient(135deg, var(--success), var(--success-text))"
                />
                <KpiCard
                    icon="🏆"
                    value={topContributor ? topContributor.name.split(' ')[0] : '—'}
                    label={topContributor ? `Top přispěvatel (${topContributor.hours.toFixed(1).replace(/\.0$/, '')} osobohodin)` : 'Top přispěvatel'}
                    gradient="linear-gradient(135deg, var(--warning), var(--warning-dark))"
                    smallValue
                />
            </div>

            {dailyData.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <ChartBlock title={`${emoji} Osobohodiny po dnech`} height={220}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dailyData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-hover)" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip content={<ChartTooltip unit="oh" />} />
                                <Bar dataKey="Osobohodiny" fill={accent.from} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartBlock>
                </div>
            )}

            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
                <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--surface-sunken)' }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-charcoal)' }}>{emoji} Žebříček přispěvatelů</h3>
                </div>
                <div style={{ padding: '0.4rem 1rem' }}>
                    {userStats.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Žádní účastníci tento měsíc.
                        </div>
                    ) : userStats.slice(0, 10).map((u, i) => {
                        const pct = (u.hours / maxUserHours) * 100;
                        const medals = ['🥇', '🥈', '🥉'];
                        const visibleCount = Math.min(userStats.length, 10);
                        return (
                            <div key={u.uid} style={{
                                display: 'flex', alignItems: 'center', gap: '0.85rem',
                                padding: '0.7rem 0',
                                borderBottom: i < visibleCount - 1 ? '1px dashed var(--border)' : 'none'
                            }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: i < 3 ? 'var(--warning-bg-soft)' : 'var(--surface-alt)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: i < 3 ? '1.1rem' : '0.85rem',
                                    fontWeight: 700,
                                    color: i < 3 ? 'var(--accent-gold)' : 'var(--text-gray)'
                                }}>
                                    {i < 3 ? medals[i] : i + 1}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {u.name}
                                    </div>
                                    <div style={{ width: '100%', height: '5px', background: 'var(--surface-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${pct}%`,
                                            height: '100%',
                                            background: accent.from,
                                            borderRadius: '3px'
                                        }} />
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-charcoal)' }}>
                                        {u.hours.toFixed(2).replace(/\.?0+$/, '')}h
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-gray)' }}>osobohodin · {u.count}× účast</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

function KpiCard({ icon, value, suffix, label, gradient, smallValue }) {
    return (
        <div className="card" style={{
            padding: '1.25rem',
            background: gradient,
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{icon}</div>
            <div style={{ fontSize: smallValue ? '1.3rem' : '1.8rem', fontWeight: 700, marginBottom: '0.2rem', wordBreak: 'break-word' }}>
                {value}{suffix && <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.85, marginLeft: '0.2rem' }}>{suffix}</span>}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.92 }}>{label}</div>
        </div>
    );
}
