import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import {
    ResponsiveContainer, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { ChartBlock, ChartTooltip } from './ChartComponents';

const DEFAULT_DAY_HOURS = 8;
const DEFAULT_NIGHT_HOURS = 11;
const MONTHS_CZ_SHORT = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];

function computeMonthShiftTotals(daysData, year, monthIdx) {
    const today = new Date();
    let day_h = 0, night_h = 0, zaloha_h = 0;
    const userMap = new Map();

    if (!daysData || Object.keys(daysData).length === 0) {
        return { day: 0, night: 0, zaloha: 0, total: 0, users: [] };
    }

    Object.entries(daysData).forEach(([dayStr, dayData]) => {
        if (!dayData || typeof dayData !== 'object') return;
        const day = parseInt(dayStr, 10);
        if (isNaN(day)) return;
        const date = new Date(year, monthIdx, day);
        if (date > today) return;

        // Day shift
        const daySlots = dayData.dayShift || {};
        Object.values(daySlots).forEach(slot => {
            if (!slot?.uid) return;
            const h = dayData.hours?.[slot.uid]?.day ?? DEFAULT_DAY_HOURS;
            day_h += h;
            const u = userMap.get(slot.uid) || { uid: slot.uid, name: slot.name || '', day: 0, night: 0, zaloha: 0 };
            u.day += h;
            userMap.set(slot.uid, u);
        });

        // Night shift
        const nightSlots = dayData.nightShift || {};
        Object.values(nightSlots).forEach(slot => {
            if (!slot?.uid) return;
            const h = dayData.hours?.[slot.uid]?.night ?? DEFAULT_NIGHT_HOURS;
            night_h += h;
            const u = userMap.get(slot.uid) || { uid: slot.uid, name: slot.name || '', day: 0, night: 0, zaloha: 0 };
            u.night += h;
            userMap.set(slot.uid, u);
        });

        // Zaloha/staz
        const zalohaSlots = dayData.zalohaStaz || {};
        const config = zalohaSlots.config;
        let zH = DEFAULT_DAY_HOURS;
        if (config?.timeFrom && config?.timeTo) {
            const [fh, fm] = config.timeFrom.split(':').map(Number);
            const [th, tm] = config.timeTo.split(':').map(Number);
            zH = Math.max(0, (th * 60 + tm - fh * 60 - fm) / 60);
        }
        Object.entries(zalohaSlots).forEach(([k, slot]) => {
            if (k === 'config' || !slot?.uid) return;
            zaloha_h += zH;
            const u = userMap.get(slot.uid) || { uid: slot.uid, name: slot.name || '', day: 0, night: 0, zaloha: 0 };
            u.zaloha += zH;
            userMap.set(slot.uid, u);
        });
    });

    return {
        day: day_h,
        night: night_h,
        zaloha: zaloha_h,
        total: day_h + night_h + zaloha_h,
        users: Array.from(userMap.values())
    };
}

async function fetchYearShifts(year) {
    const months = Array.from({ length: 12 }, (_, i) =>
        `${year}-${String(i + 1).padStart(2, '0')}`
    );
    const docs = await Promise.all(months.map(m => getDoc(doc(db, 'shifts', m))));
    return docs.map((d, i) => ({
        month: i,
        data: d.exists() ? (d.data().days || {}) : {}
    }));
}

export default function YearTab({ year }) {
    const [shiftsLoading, setShiftsLoading] = useState(true);
    const [yearShifts, setYearShifts] = useState([]);
    const [prevYearShifts, setPrevYearShifts] = useState([]);
    const [allEvents, setAllEvents] = useState([]);
    const [allTrainings, setAllTrainings] = useState([]);
    const [allMaintenance, setAllMaintenance] = useState([]);
    const [allCleaning, setAllCleaning] = useState([]);

    useEffect(() => {
        setShiftsLoading(true);
        Promise.all([fetchYearShifts(year), fetchYearShifts(year - 1)]).then(([curr, prev]) => {
            setYearShifts(curr);
            setPrevYearShifts(prev);
            setShiftsLoading(false);
        });
    }, [year]);

    useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, 'events'), snap =>
                setAllEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, 'trainings'), snap =>
                setAllTrainings(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, 'maintenanceLogs'), snap =>
                setAllMaintenance(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
            onSnapshot(collection(db, 'cleaningLogs'), snap =>
                setAllCleaning(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const yearEvents = useMemo(() =>
        allEvents.filter(e => e.date >= yearStart && e.date <= yearEnd),
        [allEvents, yearStart, yearEnd]);

    const yearTrainings = useMemo(() =>
        allTrainings.filter(t => t.date >= yearStart && t.date <= yearEnd),
        [allTrainings, yearStart, yearEnd]);

    const yearMaintenance = useMemo(() =>
        allMaintenance.filter(e => e.date >= yearStart && e.date <= yearEnd),
        [allMaintenance, yearStart, yearEnd]);

    const yearCleaning = useMemo(() =>
        allCleaning.filter(e => e.date >= yearStart && e.date <= yearEnd),
        [allCleaning, yearStart, yearEnd]);

    const monthlyShiftData = useMemo(() =>
        yearShifts.map(({ month, data }) => {
            const s = computeMonthShiftTotals(data, year, month);
            return {
                month: MONTHS_CZ_SHORT[month],
                'Den': Math.round(s.day * 10) / 10,
                'Noc': Math.round(s.night * 10) / 10,
                'Záloha': Math.round(s.zaloha * 10) / 10,
                total: Math.round(s.total * 10) / 10,
                users: s.users
            };
        }),
        [yearShifts, year]);

    const prevMonthlyShiftData = useMemo(() =>
        prevYearShifts.map(({ month, data }) => {
            const s = computeMonthShiftTotals(data, year - 1, month);
            return { total: Math.round(s.total * 10) / 10 };
        }),
        [prevYearShifts, year]);

    const yoyData = useMemo(() =>
        MONTHS_CZ_SHORT.map((m, i) => ({
            month: m,
            [String(year)]: monthlyShiftData[i]?.total ?? 0,
            [String(year - 1)]: prevMonthlyShiftData[i]?.total ?? 0,
        })),
        [monthlyShiftData, prevMonthlyShiftData, year]);

    const totalShiftHours = useMemo(() =>
        monthlyShiftData.reduce((s, m) => s + m.total, 0),
        [monthlyShiftData]);

    const maintenanceOH = useMemo(() =>
        yearMaintenance.reduce((s, e) =>
            s + (e.personHoursOverride != null
                ? Number(e.personHoursOverride)
                : (Number(e.hours) || 0) * (Number(e.peopleCount) || 0)), 0),
        [yearMaintenance]);

    const cleaningOH = useMemo(() =>
        yearCleaning.reduce((s, e) =>
            s + (e.personHoursOverride != null
                ? Number(e.personHoursOverride)
                : (Number(e.hours) || 0) * (Number(e.peopleCount) || 0)), 0),
        [yearCleaning]);

    const monthlyActivitiesData = useMemo(() =>
        MONTHS_CZ_SHORT.map((m, i) => {
            const mStr = `${year}-${String(i + 1).padStart(2, '0')}`;
            return {
                month: m,
                'Akce': yearEvents.filter(e => e.date?.startsWith(mStr)).length,
                'Školení': yearTrainings.filter(t => t.date?.startsWith(mStr)).length,
            };
        }),
        [yearEvents, yearTrainings, year]);

    const memberLeaderboard = useMemo(() => {
        const userMap = new Map();
        monthlyShiftData.forEach(m => {
            m.users.forEach(u => {
                const existing = userMap.get(u.uid) || { uid: u.uid, name: u.name, hours: 0 };
                existing.hours += u.day + u.night + u.zaloha;
                userMap.set(u.uid, existing);
            });
        });
        return Array.from(userMap.values()).sort((a, b) => b.hours - a.hours).slice(0, 10);
    }, [monthlyShiftData]);

    const hasActivities = yearEvents.length > 0 || yearTrainings.length > 0;
    const hasActivitiesChart = monthlyActivitiesData.some(m => m['Akce'] > 0 || m['Školení'] > 0);

    if (shiftsLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#aaa' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
                Načítám roční data...
            </div>
        );
    }

    return (
        <>
            {/* KPI Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1.25rem',
                marginBottom: '2rem'
            }}>
                <KpiCard icon="⏱️" value={Math.round(totalShiftHours)} suffix="h" label="Hodin služeb" color1="#F57C00" color2="#E65100" />
                <KpiCard icon="🎓" value={yearTrainings.length} label="Školení" color1="#9C27B0" color2="#6A1B9A" />
                <KpiCard icon="🏅" value={yearEvents.length} label="Akcí" color1="#E53935" color2="#C62828" />
                <KpiCard icon="🔧" value={Math.round(maintenanceOH)} suffix="oh" label="Údržba" color1="#FF6F00" color2="#E65100" />
                <KpiCard icon="🧹" value={Math.round(cleaningOH)} suffix="oh" label="Úklid" color1="#00838F" color2="#006064" />
            </div>

            {/* Monthly shift hours stacked bar */}
            <div style={{ marginBottom: '2rem' }}>
                <ChartBlock title="🚒 Hodiny služeb po měsících" height={280}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyShiftData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip unit="h" />} />
                            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                            <Bar dataKey="Den" stackId="a" fill="#F57C00" />
                            <Bar dataKey="Noc" stackId="a" fill="#3949AB" />
                            <Bar dataKey="Záloha" stackId="a" fill="#1565C0" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartBlock>
            </div>

            {/* Year-over-year comparison */}
            <div style={{ marginBottom: '2rem' }}>
                <ChartBlock title={`📈 Porovnání se ${year - 1} (hodiny služeb)`} height={260}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yoyData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip content={<ChartTooltip unit="h" />} />
                            <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                            <Bar dataKey={String(year)} fill="#F57C00" radius={[4, 4, 0, 0]} />
                            <Bar dataKey={String(year - 1)} fill="#B0BEC5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartBlock>
            </div>

            {/* Monthly activities */}
            {hasActivities && hasActivitiesChart && (
                <div style={{ marginBottom: '2rem' }}>
                    <ChartBlock title="🎓 Akce a školení po měsících" height={220}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyActivitiesData} margin={{ top: 5, right: 16, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip content={<ChartTooltip unit="" />} />
                                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                                <Bar dataKey="Akce" fill="#E53935" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Školení" fill="#9C27B0" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartBlock>
                </div>
            )}

            {/* Member leaderboard */}
            {memberLeaderboard.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid #eee', background: '#fafafa' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#444' }}>
                            🏆 Žebříček – hodiny služeb za {year}
                        </h3>
                    </div>
                    <div style={{ padding: '0.4rem 1rem' }}>
                        {memberLeaderboard.map((u, i) => {
                            const maxH = memberLeaderboard[0].hours;
                            const pct = maxH > 0 ? (u.hours / maxH) * 100 : 0;
                            const medals = ['🥇', '🥈', '🥉'];
                            return (
                                <div key={u.uid} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.85rem',
                                    padding: '0.7rem 0',
                                    borderBottom: i < memberLeaderboard.length - 1 ? '1px dashed #eee' : 'none'
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: i < 3 ? '#FFF8E1' : '#f5f5f5',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: i < 3 ? '1.1rem' : '0.85rem',
                                        fontWeight: 700, color: i < 3 ? '#FFC107' : '#999', flexShrink: 0
                                    }}>
                                        {i < 3 ? medals[i] : i + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {u.name}
                                        </div>
                                        <div style={{ width: '100%', height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: '#F57C00', borderRadius: 3 }} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#333', flexShrink: 0 }}>
                                        {Math.round(u.hours * 10) / 10}h
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}

function KpiCard({ icon, value, suffix, label, color1, color2 }) {
    return (
        <div className="card" style={{
            padding: '1.25rem',
            background: `linear-gradient(135deg, ${color1}, ${color2})`,
            color: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
        }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{icon}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                {value}
                {suffix && <span style={{ fontSize: '1rem', fontWeight: 500, opacity: 0.85, marginLeft: '0.2rem' }}>{suffix}</span>}
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.92 }}>{label}</div>
        </div>
    );
}
