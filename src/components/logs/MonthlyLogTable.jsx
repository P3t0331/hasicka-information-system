import React, { useMemo } from 'react';
import { DAYS_CZ_FULL, MONTHS_CZ } from '../../utils/constants';

const DAYS_HEAD = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatHours = (h) => {
    if (!h) return '0';
    return h.toFixed(2).replace(/\.?0+$/, '');
};

export default function MonthlyLogTable({
    title,
    accentColor,
    currentDate,
    entries,
    canCreate,
    canModifyEntry,
    onAddForDay,
    onAddGeneric,
    onEditEntry,
    onDeleteEntry,
    onMonthChange,
    onlyMine,
    setOnlyMine
}) {
    const year = currentDate.getFullYear();
    const monthIdx = currentDate.getMonth();
    const lastDay = new Date(year, monthIdx + 1, 0).getDate();
    const todayStr = todayISO();

    const entriesByDate = useMemo(() => {
        const map = new Map();
        entries.forEach(e => {
            if (!map.has(e.date)) map.set(e.date, []);
            map.get(e.date).push(e);
        });
        return map;
    }, [entries]);

    const totals = useMemo(() => {
        return entries.reduce((acc, e) => {
            const h = Number(e.hours) || 0;
            const p = Number(e.peopleCount) || 0;
            return {
                hours: acc.hours + h,
                personHours: acc.personHours + h * p,
                people: acc.people + p,
                count: acc.count + 1
            };
        }, { hours: 0, personHours: 0, people: 0, count: 0 });
    }, [entries]);

    // Build calendar grid (Mon-first weeks)
    const calendarCells = useMemo(() => {
        const firstDow = new Date(year, monthIdx, 1).getDay(); // 0=Sun
        const offset = (firstDow + 6) % 7; // shift to Mon=0
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= lastDay; d++) {
            const dateISO = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = new Date(year, monthIdx, d).getDay();
            cells.push({
                day: d,
                dateISO,
                isWeekend: dow === 0 || dow === 6,
                isToday: dateISO === todayStr,
                count: (entriesByDate.get(dateISO) || []).length
            });
        }
        while (cells.length % 7 !== 0) cells.push(null);
        return cells;
    }, [year, monthIdx, lastDay, todayStr, entriesByDate]);

    // Sorted entries by date descending, then group by day
    const groupedDays = useMemo(() => {
        const dates = Array.from(entriesByDate.keys()).sort((a, b) => a.localeCompare(b));
        return dates.map(dateISO => {
            const list = entriesByDate.get(dateISO);
            const [y, m, d] = dateISO.split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            const dayHours = list.reduce((s, e) => s + (Number(e.hours) || 0), 0);
            const dayPeople = list.reduce((s, e) => s + (Number(e.peopleCount) || 0), 0);
            return {
                dateISO,
                day: d,
                month: m,
                dayName: DAYS_CZ_FULL[dow],
                isWeekend: dow === 0 || dow === 6,
                isToday: dateISO === todayStr,
                entries: list,
                dayHours,
                dayPeople
            };
        });
    }, [entriesByDate, todayStr]);

    return (
        <div className="container mt-4" style={{ maxWidth: '960px', paddingBottom: '3rem' }}>
            {/* Header */}
            <div style={{
                background: `linear-gradient(135deg, ${accentColor.from}, ${accentColor.to})`,
                borderRadius: '14px',
                padding: '1.25rem 1.5rem',
                color: 'white',
                marginBottom: '1.25rem',
                boxShadow: `0 6px 20px ${accentColor.from}33`,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '0.3px' }}>{title}</h1>
                    <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '0.2rem' }}>
                        {MONTHS_CZ[monthIdx]} {year} · {totals.count} {totals.count === 1 ? 'záznam' : (totals.count >= 2 && totals.count <= 4 ? 'záznamy' : 'záznamů')}
                    </div>
                </div>
                {canCreate && (
                    <button
                        type="button"
                        onClick={onAddGeneric}
                        className="btn"
                        style={{
                            background: 'rgba(255,255,255,0.22)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.4)',
                            padding: '0.55rem 1.1rem',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            backdropFilter: 'blur(4px)'
                        }}
                    >
                        + Přidat záznam
                    </button>
                )}
            </div>

            {/* Toolbar: month nav + filter */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                gap: '0.75rem',
                flexWrap: 'wrap'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'white',
                    borderRadius: '999px',
                    padding: '0.25rem',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    border: '1px solid #eee'
                }}>
                    <button
                        onClick={() => onMonthChange(-1)}
                        style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            padding: '0.35rem 0.8rem', fontSize: '1rem', color: '#555', borderRadius: '999px'
                        }}
                    >←</button>
                    <span style={{
                        fontWeight: 700, color: '#333', textTransform: 'uppercase',
                        letterSpacing: '0.5px', fontSize: '0.85rem', padding: '0 0.4rem'
                    }}>
                        {MONTHS_CZ[monthIdx]} {year}
                    </span>
                    <button
                        onClick={() => onMonthChange(1)}
                        style={{
                            border: 'none', background: 'transparent', cursor: 'pointer',
                            padding: '0.35rem 0.8rem', fontSize: '1rem', color: '#555', borderRadius: '999px'
                        }}
                    >→</button>
                </div>

                <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    fontSize: '0.85rem', color: '#444', cursor: 'pointer',
                    userSelect: 'none', background: 'white', borderRadius: '999px',
                    padding: '0.45rem 0.9rem', border: '1px solid #eee',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}>
                    <input
                        type="checkbox"
                        checked={onlyMine}
                        onChange={e => setOnlyMine(e.target.checked)}
                        style={{ width: '1rem', height: '1rem', margin: 0, accentColor: accentColor.from }}
                    />
                    Pouze moje příspěvky
                </label>
            </div>

            {/* Stats strip */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.25rem'
            }}>
                <StatPill icon="⏱️" value={`${formatHours(totals.hours)}h`} label="Čas trvání" color={accentColor.from} />
                <StatPill icon="👥" value={`${formatHours(totals.personHours)}h`} label="Osobohodin" color="#1976D2" />
                <StatPill icon="🧑" value={totals.people} label="Účastí" color="#388E3C" />
                <StatPill icon="📋" value={totals.count} label="Záznamů" color="#F57C00" />
            </div>

            {/* Mini calendar */}
            <div className="card" style={{ padding: '1rem 1.1rem', marginBottom: '1.25rem' }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '0.6rem'
                }}>
                    <h3 style={{ margin: 0, fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📅 Přehled měsíce
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: '#999' }}>
                        Klikněte na den pro přidání záznamu
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.3rem' }}>
                    {DAYS_HEAD.map(d => (
                        <div key={d} style={{
                            textAlign: 'center', fontSize: '0.7rem',
                            color: '#999', fontWeight: 600, padding: '0.25rem 0'
                        }}>{d}</div>
                    ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
                    {calendarCells.map((c, i) => {
                        if (!c) return <div key={i} />;
                        const hasEntries = c.count > 0;
                        const isFuture = c.dateISO > todayStr;
                        const clickable = canCreate && !isFuture;
                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => clickable && onAddForDay(c.dateISO)}
                                disabled={!clickable}
                                title={isFuture ? 'Nelze přidat záznam v budoucnosti' : (hasEntries ? `${c.count} záznam(ů)` : 'Bez záznamů')}
                                style={{
                                    aspectRatio: '1',
                                    minHeight: '40px',
                                    border: c.isToday ? `2px solid ${accentColor.from}` : '1px solid #eee',
                                    background: hasEntries
                                        ? `linear-gradient(135deg, ${accentColor.from}22, ${accentColor.to}22)`
                                        : (c.isWeekend ? '#FFEBEE' : 'white'),
                                    borderRadius: '8px',
                                    cursor: clickable ? 'pointer' : 'default',
                                    padding: '0.3rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.85rem',
                                    fontWeight: c.isToday ? 700 : 500,
                                    color: c.isToday ? accentColor.to : (isFuture ? '#bbb' : '#444'),
                                    opacity: isFuture ? 0.55 : 1,
                                    position: 'relative',
                                    transition: 'transform 0.15s'
                                }}
                                onMouseOver={clickable ? e => e.currentTarget.style.transform = 'scale(1.05)' : undefined}
                                onMouseOut={clickable ? e => e.currentTarget.style.transform = 'scale(1)' : undefined}
                            >
                                <span>{c.day}</span>
                                {hasEntries && (
                                    <span style={{
                                        position: 'absolute',
                                        bottom: '3px',
                                        background: accentColor.from,
                                        color: 'white',
                                        fontSize: '0.55rem',
                                        fontWeight: 700,
                                        padding: '0.05rem 0.3rem',
                                        borderRadius: '999px',
                                        minWidth: '14px',
                                        lineHeight: 1.2
                                    }}>{c.count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Timeline */}
            <div>
                <h3 style={{
                    fontSize: '0.85rem', color: '#666', textTransform: 'uppercase',
                    letterSpacing: '0.5px', margin: '0 0 0.75rem 0.25rem'
                }}>
                    📋 Záznamy ({groupedDays.length} {groupedDays.length === 1 ? 'den' : (groupedDays.length >= 2 && groupedDays.length <= 4 ? 'dny' : 'dnů')})
                </h3>

                {groupedDays.length === 0 ? (
                    <div className="card" style={{
                        padding: '2.5rem 1.5rem',
                        textAlign: 'center',
                        color: '#888',
                        background: '#fafafa',
                        border: '1px dashed #ddd'
                    }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>📭</div>
                        <p style={{ margin: 0, fontSize: '0.95rem' }}>
                            {onlyMine ? 'Tento měsíc nemáte žádné záznamy.' : 'V tomto měsíci nejsou žádné záznamy.'}
                        </p>
                        {canCreate && !onlyMine && (
                            <button
                                type="button"
                                onClick={onAddGeneric}
                                className="btn"
                                style={{
                                    marginTop: '1rem',
                                    background: accentColor.from,
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.5rem 1.1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 600
                                }}
                            >
                                + Přidat první záznam
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {groupedDays.map(day => (
                            <DaySection
                                key={day.dateISO}
                                day={day}
                                accentColor={accentColor}
                                canCreate={canCreate}
                                canModifyEntry={canModifyEntry}
                                onAddForDay={onAddForDay}
                                onEditEntry={onEditEntry}
                                onDeleteEntry={onDeleteEntry}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatPill({ icon, value, label, color }) {
    return (
        <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '0.75rem 0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.7rem',
            border: '1px solid #eee',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}>
            <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: `${color}1A`, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem', flexShrink: 0
            }}>{icon}</div>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#222', lineHeight: 1.1 }}>{value}</div>
                <div style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
            </div>
        </div>
    );
}

function DaySection({ day, accentColor, canCreate, canModifyEntry, onAddForDay, onEditEntry, onDeleteEntry }) {
    return (
        <div className="card" style={{
            padding: 0,
            overflow: 'hidden',
            border: day.isToday ? `2px solid ${accentColor.from}` : '1px solid #eee'
        }}>
            {/* Day header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                background: day.isToday
                    ? `linear-gradient(90deg, ${accentColor.from}15, transparent)`
                    : (day.isWeekend ? '#FFF5F5' : '#fafafa'),
                borderBottom: '1px solid #f0f0f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                    <div style={{
                        width: '44px', height: '44px',
                        borderRadius: '10px',
                        background: day.isToday
                            ? `linear-gradient(135deg, ${accentColor.from}, ${accentColor.to})`
                            : (day.isWeekend ? '#FFCDD2' : '#eceff1'),
                        color: day.isToday ? 'white' : (day.isWeekend ? '#C62828' : '#37474F'),
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, lineHeight: 1, flexShrink: 0
                    }}>
                        <div style={{ fontSize: '1.05rem' }}>{day.day}.</div>
                        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.85, marginTop: '0.1rem' }}>
                            {MONTHS_CZ[day.month - 1].slice(0, 3)}
                        </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{
                            fontWeight: 600, color: '#222', fontSize: '0.95rem',
                            textTransform: 'capitalize'
                        }}>
                            {day.dayName}
                            {day.isToday && (
                                <span style={{
                                    marginLeft: '0.5rem', fontSize: '0.65rem',
                                    background: accentColor.from, color: 'white',
                                    padding: '0.1rem 0.45rem', borderRadius: '999px',
                                    textTransform: 'uppercase', letterSpacing: '0.5px',
                                    fontWeight: 700, verticalAlign: 'middle'
                                }}>Dnes</span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.1rem' }}>
                            ⏱️ {formatHours(day.dayHours)}h · 👥 {day.dayPeople}
                        </div>
                    </div>
                </div>
                {canCreate && (
                    <button
                        type="button"
                        onClick={() => onAddForDay(day.dateISO)}
                        style={{
                            background: 'transparent',
                            border: `1px dashed ${accentColor.from}66`,
                            color: accentColor.to,
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.3rem 0.6rem',
                            borderRadius: '6px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        + Další
                    </button>
                )}
            </div>

            {/* Entries */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {day.entries.map((entry, idx) => (
                    <EntryRow
                        key={entry.id}
                        entry={entry}
                        accentColor={accentColor}
                        canModify={canModifyEntry(entry)}
                        onEdit={() => onEditEntry(entry)}
                        onDelete={() => onDeleteEntry(entry)}
                        isLast={idx === day.entries.length - 1}
                    />
                ))}
            </div>
        </div>
    );
}

function EntryRow({ entry, accentColor, canModify, onEdit, onDelete, isLast }) {
    return (
        <div style={{
            padding: '0.85rem 1rem',
            borderBottom: isLast ? 'none' : '1px solid #f5f5f5',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            position: 'relative'
        }}>
            <div style={{
                width: '4px', alignSelf: 'stretch', borderRadius: '2px',
                background: accentColor.from, opacity: 0.7, flexShrink: 0
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontWeight: 500, color: '#222',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontSize: '0.95rem', marginBottom: '0.4rem'
                }}>
                    {entry.description}
                </div>

                {(entry.participants?.length > 0 || entry.externalParticipants?.length > 0) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.5rem' }}>
                        {(entry.participants || []).map(p => (
                            <span key={p.uid} style={{
                                fontSize: '0.7rem',
                                background: '#E3F2FD', color: '#1565C0',
                                padding: '0.15rem 0.5rem', borderRadius: '999px',
                                border: '1px solid #BBDEFB'
                            }}>
                                {p.name}
                            </span>
                        ))}
                        {(entry.externalParticipants || []).map((name, i) => (
                            <span key={`ext-${i}`} style={{
                                fontSize: '0.7rem',
                                background: '#F3E5F5', color: '#7B1FA2',
                                padding: '0.15rem 0.5rem', borderRadius: '999px',
                                border: '1px solid #E1BEE7'
                            }}>
                                {name}
                            </span>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
                    <Badge icon="⏱️" text={`${formatHours(Number(entry.hours) || 0)}h`} />
                    <Badge icon="👥" text={`${entry.peopleCount || 0} osob`} />
                    {entry.createdBy?.name && (
                        <Badge icon="✍️" text={entry.createdBy.name} muted />
                    )}
                </div>
            </div>

            {canModify && (
                <div style={{ display: 'flex', gap: '0.15rem', flexShrink: 0 }}>
                    <button
                        onClick={onEdit}
                        title="Upravit"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1rem', color: '#1976D2',
                            padding: '0.3rem', borderRadius: '6px'
                        }}
                    >✏️</button>
                    <button
                        onClick={onDelete}
                        title="Smazat"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontSize: '1.25rem', color: '#d32f2f', lineHeight: 1,
                            padding: '0.2rem 0.45rem', borderRadius: '6px'
                        }}
                    >×</button>
                </div>
            )}
        </div>
    );
}

function Badge({ icon, text, muted }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            background: muted ? 'transparent' : '#f5f5f5',
            padding: muted ? 0 : '0.15rem 0.5rem',
            borderRadius: '999px',
            color: muted ? '#999' : '#555',
            fontSize: '0.7rem',
            fontWeight: muted ? 400 : 500
        }}>
            <span>{icon}</span>
            <span>{text}</span>
        </span>
    );
}
