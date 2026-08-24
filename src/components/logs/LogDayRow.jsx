import React from 'react';

const WEEKEND_BG = 'var(--danger-bg)';
const TODAY_BG = 'var(--warning-bg-soft)';

export default function LogDayRow({
    day,
    dayName,
    isWeekend,
    isToday,
    dateISO,
    entries,
    canCreate,
    canModifyEntry,
    onAddForDay,
    onEditEntry,
    onDeleteEntry
}) {
    const totalHours = entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);
    const totalPeople = entries.reduce((sum, e) => sum + (Number(e.peopleCount) || 0), 0);

    const baseStyle = {
        background: isToday ? TODAY_BG : (isWeekend ? WEEKEND_BG : 'var(--surface)'),
        borderBottom: '1px solid var(--surface-hover)'
    };

    return (
        <tr style={baseStyle}>
            <td data-label="Datum" style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--text-charcoal)', whiteSpace: 'nowrap', width: '60px' }}>
                {day}.
            </td>
            <td data-label="Den" style={{ padding: '0.6rem 0.75rem', color: 'var(--text-steel)', whiteSpace: 'nowrap', width: '90px' }}>
                {dayName}
            </td>
            <td data-label="Co bylo provedeno" style={{ padding: '0.6rem 0.75rem' }}>
                {entries.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-faint)' }}>
                        <span>—</span>
                        {canCreate && (
                            <button
                                type="button"
                                onClick={() => onAddForDay(dateISO)}
                                style={{
                                    background: 'transparent',
                                    border: '1px dashed var(--border-strong)',
                                    color: 'var(--text-steel)',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '4px'
                                }}
                            >
                                + Přidat
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {entries.map(entry => {
                            const canModify = canModifyEntry(entry);
                            return (
                                <div key={entry.id} style={{
                                    display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
                                    gap: '0.5rem', justifyContent: 'space-between'
                                }}>
                                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {entry.description}
                                        </div>
                                        {(entry.participants?.length > 0 || entry.externalParticipants?.length > 0) && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                                                {(entry.participants || []).map(p => (
                                                    <span key={p.uid} style={{
                                                        fontSize: '0.7rem',
                                                        background: 'var(--info-bg)',
                                                        color: 'var(--info-text)',
                                                        padding: '0.1rem 0.45rem',
                                                        borderRadius: '999px',
                                                        border: '1px solid var(--info-border)'
                                                    }}>
                                                        {p.name}
                                                    </span>
                                                ))}
                                                {(entry.externalParticipants || []).map((name, i) => (
                                                    <span key={`ext-${i}`} style={{
                                                        fontSize: '0.7rem',
                                                        background: 'var(--accent-purple-bg)',
                                                        color: 'var(--accent-purple)',
                                                        padding: '0.1rem 0.45rem',
                                                        borderRadius: '999px',
                                                        border: '1px solid var(--accent-purple-border)'
                                                    }}>
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {canModify && (
                                        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                            <button
                                                onClick={() => onEditEntry(entry)}
                                                title="Upravit"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--info)', padding: '0.1rem 0.3rem' }}
                                            >✏️</button>
                                            <button
                                                onClick={() => onDeleteEntry(entry)}
                                                title="Smazat"
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--danger)', padding: '0.1rem 0.3rem' }}
                                            >×</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {canCreate && (
                            <button
                                type="button"
                                onClick={() => onAddForDay(dateISO)}
                                style={{
                                    alignSelf: 'flex-start',
                                    background: 'transparent',
                                    border: '1px dashed var(--border-strong)',
                                    color: 'var(--text-steel)',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.45rem',
                                    borderRadius: '4px',
                                    marginTop: '0.1rem'
                                }}
                            >
                                + Další záznam
                            </button>
                        )}
                    </div>
                )}
            </td>
            <td data-label="Odprac." style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '80px', fontWeight: 600 }}>
                {totalPeople || ''}
            </td>
            <td data-label="Čas (h)" style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '80px', fontWeight: 600 }}>
                {totalHours ? totalHours.toFixed(2).replace(/\.?0+$/, '') : ''}
            </td>
        </tr>
    );
}
