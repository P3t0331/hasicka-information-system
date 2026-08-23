import React from 'react';
import { Link } from 'react-router-dom';
import { MEMBER_STATUS, pragueDateString } from '../../../shared/quizStatus.js';

const STATUS_CONFIG = {
    [MEMBER_STATUS.NOT_STARTED]: { label: 'Nesplněno', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
    [MEMBER_STATUS.IN_PROGRESS]: { label: 'Rozpracováno', color: 'var(--warning-dark)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
    [MEMBER_STATUS.PENDING_REVIEW]: { label: 'Čeká na vyhodnocení', color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
    [MEMBER_STATUS.PASSED]: { label: 'Splnil', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
    [MEMBER_STATUS.FAILED]: { label: 'Nesplnil', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
};

const DESCRIPTION_MAX_LENGTH = 140;

function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${Number(d)}. ${Number(m)}. ${y}`;
}

function truncate(text, max) {
    if (!text) return '';
    if (text.length <= max) return text;
    return `${text.slice(0, max).trimEnd()}…`;
}

function getCountdown(deadline) {
    if (!deadline) return null;
    const todayISO = pragueDateString(new Date().toISOString());
    const diffDays = Math.round(
        (new Date(`${deadline}T00:00:00`) - new Date(`${todayISO}T00:00:00`)) / 86400000
    );
    if (diffDays < 0) return { text: 'Po termínu', isPast: true };
    if (diffDays === 0) return { text: 'Dnes je poslední den', isPast: false };
    if (diffDays === 1) return { text: 'Zbývá 1 den', isPast: false };
    if (diffDays >= 2 && diffDays <= 4) return { text: `Zbývají ${diffDays} dny`, isPast: false };
    return { text: `Zbývá ${diffDays} dní`, isPast: false };
}

export default function QuizCard({ quiz }) {
    const { myStatus, myBest, canStart } = quiz;
    const cfg = STATUS_CONFIG[myStatus] || STATUS_CONFIG[MEMBER_STATUS.NOT_STARTED];
    const countdown = getCountdown(quiz.deadline);
    const score = typeof myBest?.scorePercent === 'number' ? Math.round(myBest.scorePercent) : null;

    let statusLabel = cfg.label;
    if (myStatus === MEMBER_STATUS.PASSED && score !== null) statusLabel = `Splnil (${score} %)`;
    if (myStatus === MEMBER_STATUS.FAILED && score !== null) statusLabel = `Nesplnil (${score} %)`;

    let buttonLabel = 'Vyplnit';
    if (myStatus === MEMBER_STATUS.IN_PROGRESS) buttonLabel = 'Pokračovat';
    else if (myStatus === MEMBER_STATUS.PENDING_REVIEW) buttonLabel = 'Zobrazit';
    else if (myStatus === MEMBER_STATUS.PASSED) buttonLabel = 'Zobrazit';
    else if (myStatus === MEMBER_STATUS.FAILED) buttonLabel = canStart ? 'Zkusit znovu' : 'Zobrazit';

    const cardStyle = {
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        ...(countdown?.isPast ? { borderLeft: '4px solid var(--danger)' } : {}),
    };

    return (
        <div className="card" style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.02rem', color: 'var(--text-primary)' }}>{quiz.title}</h3>
                <span style={{
                    fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem',
                    borderRadius: '999px', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
                    whiteSpace: 'nowrap',
                }}>
                    {statusLabel}
                </span>
            </div>

            {quiz.description && (
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {truncate(quiz.description, DESCRIPTION_MAX_LENGTH)}
                </p>
            )}

            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Termín: {formatDate(quiz.deadline)}</span>
                {countdown && (
                    <span style={{ fontWeight: 600, color: countdown.isPast ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {countdown.text}
                    </span>
                )}
            </div>

            <div>
                <Link to={`/skoleni/kviz/${quiz.id}`} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                    {buttonLabel}
                </Link>
            </div>
        </div>
    );
}
