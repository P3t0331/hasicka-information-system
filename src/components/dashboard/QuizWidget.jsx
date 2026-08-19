import React from 'react';
import { Link } from 'react-router-dom';
import useMyQuizzes from '../../hooks/useMyQuizzes';
import { MEMBER_STATUS, pragueDateString } from '../../../shared/quizStatus.js';
import { pluralize } from '../../utils/pluralize';

// Stejná paleta jako priority na nástěnce (viz BulletinWidget) — 'past' odpovídá
// urgentní, 'soon' důležité, 'normal' běžné.
const URGENCY_CONFIG = {
    normal: { color: '#546E7A', bg: '#fff', border: '#B0BEC5' },
    soon: { color: '#E65100', bg: '#FFFDE7', border: '#FFCC80' },
    past: { color: '#C62828', bg: '#FFF5F5', border: '#EF9A9A' },
};

const ACTIONABLE_STATUSES = [MEMBER_STATUS.NOT_STARTED, MEMBER_STATUS.IN_PROGRESS, MEMBER_STATUS.FAILED];

function getCountdown(deadline) {
    if (!deadline) return null;
    const todayISO = pragueDateString(new Date().toISOString());
    const diffDays = Math.round(
        (new Date(`${deadline}T00:00:00`) - new Date(`${todayISO}T00:00:00`)) / 86400000
    );
    if (diffDays < 0) return { text: 'Po termínu', urgency: 'past' };
    if (diffDays === 0) return { text: 'Dnes je poslední den', urgency: 'soon' };
    const noun = pluralize(diffDays, 'den', 'dny', 'dní');
    const verb = diffDays >= 2 && diffDays <= 4 ? 'Zbývají' : 'Zbývá';
    return { text: `${verb} ${diffDays} ${noun}`, urgency: diffDays <= 3 ? 'soon' : 'normal' };
}

function sortByDeadline(a, b) {
    if (!a.deadline && !b.deadline) return 0;
    if (!a.deadline) return 1;
    if (!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
}

export default function QuizWidget() {
    const { myQuizzes, loading } = useMyQuizzes();

    if (loading) return null;

    const pending = myQuizzes
        .filter(quiz => quiz.canStart && ACTIONABLE_STATUSES.includes(quiz.myStatus))
        .sort(sortByDeadline);

    if (pending.length === 0) return null;

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            {/* Widget header */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '0.6rem'
            }}>
                <span style={{ fontSize: '1rem' }}>📝</span>
                <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Nesplněné kvízy
                </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {pending.map(quiz => {
                    const countdown = getCountdown(quiz.deadline);
                    const uc = URGENCY_CONFIG[countdown?.urgency || 'normal'];

                    return (
                        <div
                            key={quiz.id}
                            style={{
                                background: uc.bg,
                                border: `1px solid ${uc.border}`,
                                borderLeft: `4px solid ${uc.border}`,
                                borderRadius: '10px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                flexWrap: 'wrap',
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#222' }}>
                                    {quiz.title}
                                </div>
                                {countdown && (
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: uc.color, marginTop: '0.15rem' }}>
                                        {countdown.text}
                                    </div>
                                )}
                            </div>
                            <Link to={`/skoleni/kviz/${quiz.id}`} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                                Vyplnit
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
