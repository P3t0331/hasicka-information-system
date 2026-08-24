import React, { useState, useMemo } from 'react';
import { MEMBER_STATUS } from '../../../../shared/quizStatus.js';

// Stejné barvy jako štítek stavu na kartě kvízu (src/components/quizzes/QuizCard.jsx) —
// admin i člen mají pro stejný stav vidět stejnou barvu.
const STATUS_CONFIG = {
    [MEMBER_STATUS.NOT_STARTED]: { label: 'Nevyplnil', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
    [MEMBER_STATUS.IN_PROGRESS]: { label: 'Rozpracováno', color: 'var(--warning-dark)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
    [MEMBER_STATUS.PENDING_REVIEW]: { label: 'Čeká na vyhodnocení', color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
    [MEMBER_STATUS.PASSED]: { label: 'Splnil', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
    [MEMBER_STATUS.FAILED]: { label: 'Nesplnil', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
};

// Souhrnné karty nad tabulkou. `filterKey` je hodnota lokálního filtru — 'all'
// pro Celkem (bez filtrování), 'notStarted' zahrnuje jak NOT_STARTED, tak
// IN_PROGRESS (obojí je z pohledu velitele "ještě nehotovo").
//
// Karta "Celkem" (ne "Přiřazeno"!) — `summary.assigned`/`rows.length` počítá
// i členy, kteří už kvíz nemají přiřazený, ale mají k němu historický pokus
// (viz useQuizResults.js). Štítek "Přiřazeno" by u toho čísla lhal — čtenář
// by ho přečetl jako "kolik lidí to musí vyplnit" a číslo je vyšší, kdykoli
// se změnilo obsazení jednotky. Počet se neupravuje, mění se jen popisek.
const SUMMARY_CARDS = [
    { key: 'assigned', filterKey: 'all', label: 'Celkem', color: 'var(--neutral-dark)', bg: 'var(--neutral-bg)', border: 'var(--neutral-border)' },
    { key: 'passed', filterKey: 'passed', label: 'Splnilo', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
    { key: 'failed', filterKey: 'failed', label: 'Nesplnilo', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
    { key: 'pending', filterKey: 'pending', label: 'Čeká na vyhodnocení', color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
    { key: 'notStarted', filterKey: 'notStarted', label: 'Nevyplnilo', color: 'var(--text-secondary)', bg: 'var(--surface-alt)', border: 'var(--border-strong)' },
];

function matchesFilter(status, filterKey) {
    if (filterKey === 'all') return true;
    if (filterKey === 'passed') return status === MEMBER_STATUS.PASSED;
    if (filterKey === 'failed') return status === MEMBER_STATUS.FAILED;
    if (filterKey === 'pending') return status === MEMBER_STATUS.PENDING_REVIEW;
    if (filterKey === 'notStarted') return status === MEMBER_STATUS.NOT_STARTED || status === MEMBER_STATUS.IN_PROGRESS;
    return true;
}

function hasSubmittedAttempt(row) {
    return (row.attempts || []).some(a => a.status !== 'in_progress');
}

function formatScore(row) {
    // scorePercent je u čekajícího na vyhodnocení null záměrně — nikdy se
    // tady nesmí ukázat žádné číslo (ani 0 %, ani "—%"), ten stav se popisuje
    // slovně, ne skóre.
    if (row.status === MEMBER_STATUS.PENDING_REVIEW) return STATUS_CONFIG[MEMBER_STATUS.PENDING_REVIEW].label;
    if (typeof row.scorePercent === 'number') return `${Math.round(row.scorePercent)} %`;
    return '—';
}

function formatSubmittedAt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('cs-CZ', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

function formatAttemptsCount(n) {
    if (!n) return '—';
    if (n === 1) return '1 pokus';
    if (n >= 2 && n <= 4) return `${n} pokusy`;
    return `${n} pokusů`;
}

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[MEMBER_STATUS.NOT_STARTED];
    return (
        <span style={{
            fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem',
            borderRadius: '999px', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
            whiteSpace: 'nowrap', display: 'inline-block',
        }}>
            {cfg.label}
        </span>
    );
}

function LateMarker() {
    return (
        <span style={{
            fontSize: '0.68rem', fontWeight: 700, padding: '0.1rem 0.4rem', marginLeft: '0.4rem',
            borderRadius: '999px', color: 'var(--warning-dark)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
            whiteSpace: 'nowrap',
        }}>
            Pozdě
        </span>
    );
}

const thStyle = {
    padding: '0.85rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 600,
    color: 'var(--text-secondary)', background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)',
};
const tdStyle = {
    padding: '0.85rem 1rem', fontSize: '0.88rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)',
};

export default function QuizResultsTable({ rows, onSelectMember }) {
    const [filterKey, setFilterKey] = useState('all');

    const summary = useMemo(() => {
        const s = {
            assigned: rows.length, passed: 0, failed: 0, pending: 0, notStarted: 0,
        };
        rows.forEach((row) => {
            if (row.status === MEMBER_STATUS.PASSED) s.passed += 1;
            else if (row.status === MEMBER_STATUS.FAILED) s.failed += 1;
            else if (row.status === MEMBER_STATUS.PENDING_REVIEW) s.pending += 1;
            else s.notStarted += 1;
        });
        return s;
    }, [rows]);

    const filteredRows = useMemo(
        () => rows.filter(row => matchesFilter(row.status, filterKey)),
        [rows, filterKey],
    );

    function handleRowClick(row) {
        if (!hasSubmittedAttempt(row)) return;
        onSelectMember(row);
    }

    return (
        <div>
            {/* Souhrnné karty — zároveň filtr tabulky pod nimi */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem',
                marginBottom: '1.25rem',
            }}>
                {SUMMARY_CARDS.map((card) => {
                    const active = filterKey === card.filterKey;
                    return (
                        <button
                            key={card.key}
                            type="button"
                            onClick={() => setFilterKey(active && card.filterKey !== 'all' ? 'all' : card.filterKey)}
                            style={{
                                textAlign: 'left', cursor: 'pointer', borderRadius: '10px',
                                padding: '0.85rem 1rem', background: active ? card.bg : 'var(--surface)',
                                border: `1px solid ${active ? card.border : 'var(--border)'}`,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                            }}
                        >
                            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: card.color }}>
                                {summary[card.key]}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                                {card.label}
                            </div>
                        </button>
                    );
                })}
            </div>

            {filteredRows.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0 }}>Žádní členové neodpovídají zvolenému filtru.</p>
                </div>
            )}

            {filteredRows.length > 0 && (
                <>
                    {/* Desktop: tabulka */}
                    <div
                        className="d-desktop-only"
                        style={{ background: 'var(--surface)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                    >
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>Jméno</th>
                                    <th style={thStyle}>Stav</th>
                                    <th style={thStyle}>Skóre</th>
                                    <th style={thStyle}>Odevzdáno</th>
                                    <th style={thStyle}>Pokusy</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row) => {
                                    const clickable = hasSubmittedAttempt(row);
                                    return (
                                        <tr
                                            key={row.uid}
                                            onClick={() => handleRowClick(row)}
                                            style={{ cursor: clickable ? 'pointer' : 'default' }}
                                            onMouseEnter={e => { if (clickable) e.currentTarget.style.background = 'var(--surface-sunken)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <td style={tdStyle}>{row.name}</td>
                                            <td style={tdStyle}><StatusBadge status={row.status} /></td>
                                            <td style={tdStyle}>{formatScore(row)}</td>
                                            <td style={tdStyle}>
                                                {formatSubmittedAt(row.submittedAt)}
                                                {row.submittedAt && row.isLate && <LateMarker />}
                                            </td>
                                            <td style={tdStyle}>{formatAttemptsCount(row.attemptsCount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobil: seznam karet — pětisloupcová tabulka by na telefonu nešla přečíst */}
                    <div className="d-mobile-only">
                        {filteredRows.map((row) => {
                            const clickable = hasSubmittedAttempt(row);
                            return (
                                <div
                                    key={row.uid}
                                    className="card"
                                    onClick={() => handleRowClick(row)}
                                    style={{ padding: '1rem', marginBottom: '0.75rem', cursor: clickable ? 'pointer' : 'default' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '0.95rem' }}>{row.name}</strong>
                                        <StatusBadge status={row.status} />
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div>Skóre: {formatScore(row)}</div>
                                        <div>
                                            Odevzdáno: {formatSubmittedAt(row.submittedAt)}
                                            {row.submittedAt && row.isLate && <LateMarker />}
                                        </div>
                                        <div>Pokusy: {formatAttemptsCount(row.attemptsCount)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
