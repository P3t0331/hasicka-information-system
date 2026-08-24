import React from 'react';
import { Link } from 'react-router-dom';
import useMyQuizzes from '../../hooks/useMyQuizzes';
import { MEMBER_STATUS } from '../../../shared/quizStatus.js';
import { pluralize } from '../../utils/pluralize';

// Stejné barvy jako štítek stavu jinde v modulu kvízů (QuizCard, QuizResultView,
// QuizResultsTable) — člen musí vidět stejný verdikt stejnou barvou všude.
const VERDICT_CONFIG = {
    [MEMBER_STATUS.PASSED]: { label: 'Splnil', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
    [MEMBER_STATUS.FAILED]: { label: 'Nesplnil', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
    [MEMBER_STATUS.PENDING_REVIEW]: { label: 'Čeká na vyhodnocení', color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
};

function formatSubmittedAt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('cs-CZ', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
}

// Odevzdaný pokus, který řádek historie zastupuje — musí odpovídat tomu, co
// už `useMyQuizzes` vyhodnotil jako `myStatus`/`myBest`, ne druhé nezávislé
// interpretaci stejných dat:
// - `myBest` je nejlepší OHODNOCENÝ pokus (má číselné scorePercent) — pokud
//   existuje, je to přesně ten pokus, ke kterému se váže `myStatus` PASSED
//   nebo FAILED.
// - Když `myBest` chybí, ale kvíz má odevzdaný pokus, jde o PENDING_REVIEW
//   (scorePercent je u něj `null` záměrně, dokud ho velitel neohodnotí) —
//   zobrazí se nejnovější takový pokus, žádné skóre se nevymýšlí.
function representativeAttempt(quiz) {
    if (quiz.myBest) return quiz.myBest;
    const pending = (quiz.myAttempts || []).filter(a => a.status === 'pending_review');
    if (!pending.length) return null;
    return pending.reduce(
        (latest, a) => (!latest || (a.submittedAt || '') > (latest.submittedAt || '') ? a : latest),
        null,
    );
}

function pluralKvizu(n) {
    return pluralize(n, 'kvíz', 'kvízy', 'kvízů');
}

function EmptyState() {
    return (
        <div style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-faint)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4 }}>📝</div>
            <p style={{ fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>
                Zatím jste neabsolvoval žádný kvíz.
            </p>
        </div>
    );
}

/**
 * Karta v profilu člena se seznamem kvízů, které už alespoň jednou odevzdal —
 * jeho osobní historie absolvování. Podoba karty (obal, hlavička, seznam
 * s odděleným řádky) je převzatá z `EquipmentSection`, včetně vlastního
 * `<style>` bloku — komponenta tak funguje samostatně, ať už se v profilu
 * vykresluje vedle `EquipmentSection`, nebo ne.
 */
export default function QuizHistory() {
    const { myQuizzes, loading } = useMyQuizzes();

    const rows = myQuizzes
        .map(quiz => ({ quiz, attempt: representativeAttempt(quiz) }))
        .filter(row => row.attempt)
        .sort((a, b) => (b.attempt.submittedAt || '').localeCompare(a.attempt.submittedAt || ''));

    if (loading) return null;

    return (
        <>
            <style>{`
                .qh-wrap {
                    background: var(--glass-bg);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    border-radius: var(--radius);
                    box-shadow: var(--shadow-soft);
                    border: var(--glass-border);
                    overflow: hidden;
                }
                .qh-header {
                    padding: 1.35rem 1.75rem;
                    background: var(--surface-alt);
                    border-bottom: 1px solid rgba(0,0,0,0.07);
                }
                .qh-header-title {
                    font-family: 'Oswald', sans-serif;
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    text-transform: uppercase;
                    letter-spacing: 0.7px;
                    margin: 0 0 0.15rem;
                }
                .qh-header-sub {
                    font-size: 0.8rem;
                    color: var(--text-faint);
                    margin: 0;
                }
                .qh-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .qh-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    padding: 1.05rem 1.75rem;
                    border-bottom: 1px solid var(--border);
                    transition: background 0.12s;
                    position: relative;
                }
                .qh-item:last-child { border-bottom: none; }
                .qh-item::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 3px;
                    background: transparent;
                    transition: background 0.12s;
                    border-radius: 0 2px 2px 0;
                }
                .qh-item:hover { background: var(--danger-bg-soft); }
                .qh-item:hover::before { background: var(--primary-red); }
                .qh-name {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    line-height: 1.3;
                }
                .qh-date {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    margin-top: 0.2rem;
                }
                .qh-result {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-shrink: 0;
                }
                .qh-score {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-secondary);
                }
                .qh-link {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--primary-red);
                    text-decoration: none;
                    white-space: nowrap;
                }
                .qh-link:hover { text-decoration: underline; }
                .qh-badge {
                    display: inline-flex;
                    align-items: center;
                    font-size: 0.7rem;
                    padding: 0.18rem 0.58rem;
                    border-radius: 20px;
                    font-weight: 600;
                    border: 1px solid;
                    line-height: 1.6;
                    white-space: nowrap;
                }

                @media (max-width: 640px) {
                    .qh-header { padding: 1.1rem 1.25rem; }
                    .qh-item { padding: 1rem 1.25rem; }
                    .qh-item::before { display: none; }
                }
            `}</style>

            <div className="qh-wrap">
                <div className="qh-header">
                    <p className="qh-header-title">Absolvované kvízy</p>
                    {rows.length > 0 && (
                        <p className="qh-header-sub">{rows.length} {pluralKvizu(rows.length)}</p>
                    )}
                </div>

                {rows.length === 0 ? (
                    <EmptyState />
                ) : (
                    <ul className="qh-list">
                        {rows.map(({ quiz, attempt }) => {
                            const verdict = VERDICT_CONFIG[attempt.status] || VERDICT_CONFIG[MEMBER_STATUS.FAILED];
                            const score = typeof attempt.scorePercent === 'number'
                                ? `${Math.round(attempt.scorePercent)} %`
                                : null;

                            return (
                                <li key={quiz.id} className="qh-item">
                                    <div>
                                        <div className="qh-name">{quiz.title}</div>
                                        <div className="qh-date">Odevzdáno: {formatSubmittedAt(attempt.submittedAt)}</div>
                                    </div>

                                    <div className="qh-result">
                                        {score && <span className="qh-score">{score}</span>}
                                        <span className="qh-badge" style={{
                                            background: verdict.bg,
                                            color: verdict.color,
                                            borderColor: verdict.border,
                                        }}>
                                            {verdict.label}
                                        </span>
                                        <Link to={`/skoleni/kviz/${quiz.id}`} className="qh-link">
                                            Zobrazit
                                        </Link>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
}
