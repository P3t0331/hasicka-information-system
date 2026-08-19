import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useQuizzes from '../../hooks/useQuizzes';

const STATUS_CONFIG = {
    draft:     { label: 'Koncept', color: '#546E7A', bg: '#ECEFF1', border: '#B0BEC5' },
    published: { label: 'Aktivní', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
    closed:    { label: 'Uzavřený', color: '#616161', bg: '#F5F5F5', border: '#BDBDBD' },
};

const FILTERS = [
    { key: 'draft', label: 'Koncepty' },
    { key: 'published', label: 'Aktivní' },
    { key: 'closed', label: 'Uzavřené' },
];

function formatDate(iso) {
    if (!iso) return 'Bez termínu';
    const [y, m, d] = iso.split('-');
    return `${Number(d)}. ${Number(m)}. ${y}`;
}

function formatQuestionCount(n) {
    if (n === 1) return '1 otázka';
    if (n >= 2 && n <= 4) return `${n} otázky`;
    return `${n} otázek`;
}

function describeAssignment(quiz) {
    const mode = quiz.assignment?.mode;
    if (mode === 'roles') {
        const roles = quiz.assignment?.roles || [];
        return roles.length ? `Role: ${roles.join(', ')}` : 'Role: (nevybráno)';
    }
    if (mode === 'training') return 'Účastníci školení';
    return 'Všichni členové';
}

export default function QuizzesTab() {
    const navigate = useNavigate();
    const { quizzes, loading, createQuiz, duplicateQuiz, closeQuiz, deleteQuiz } = useQuizzes();

    const [statusFilter, setStatusFilter] = useState('published');
    const [creating, setCreating] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'close' | 'delete', quiz }

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Načítání kvízů…</div>;
    }

    async function handleCreate() {
        setCreating(true);
        try {
            const newId = await createQuiz();
            if (newId) navigate(`/admin/kviz/${newId}`);
        } finally {
            setCreating(false);
        }
    }

    async function handleConfirm() {
        if (!confirmAction) return;
        if (confirmAction.type === 'close') {
            await closeQuiz(confirmAction.quiz.id);
        } else if (confirmAction.type === 'delete') {
            await deleteQuiz(confirmAction.quiz.id);
        }
        setConfirmAction(null);
    }

    const filteredQuizzes = quizzes.filter(q => q.status === statusFilter);

    return (
        <div>
            {/* Confirm close/delete modal */}
            {confirmAction && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}
                    onClick={() => setConfirmAction(null)}
                >
                    <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%', animation: 'fadeIn 0.2s' }}>
                        <h3 style={{ marginTop: 0 }}>
                            {confirmAction.type === 'close' ? 'Uzavřít kvíz?' : 'Smazat koncept?'}
                        </h3>
                        <p style={{ color: '#555', marginBottom: '1.25rem' }}>
                            {confirmAction.type === 'close'
                                ? <>Kvíz <strong>„{confirmAction.quiz.title}"</strong> bude uzavřen a členové na něj již nebudou moci odpovídat.</>
                                : <>Koncept <strong>„{confirmAction.quiz.title}"</strong> bude trvale smazán.</>
                            }
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmAction(null)}>Zrušit</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: '#d32f2f', borderColor: '#d32f2f' }} onClick={handleConfirm}>
                                {confirmAction.type === 'close' ? 'Uzavřít' : 'Smazat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Kvízy</h2>
                <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>+ Nový kvíz</button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setStatusFilter(f.key)}
                        className={`btn ${statusFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.85rem' }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {filteredQuizzes.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, marginBottom: quizzes.length === 0 ? '1rem' : 0 }}>Zatím žádné kvízy.</p>
                    {quizzes.length === 0 && (
                        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>Vytvořit první kvíz</button>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredQuizzes.map(quiz => {
                    const cfg = STATUS_CONFIG[quiz.status] || STATUS_CONFIG.draft;
                    return (
                        <div key={quiz.id} className="card" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '220px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                                            {quiz.title || '(Bez názvu)'}
                                        </h3>
                                        <span style={{
                                            fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.55rem',
                                            borderRadius: '999px', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`
                                        }}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
                                        {quiz.deadline ? `Termín: ${formatDate(quiz.deadline)}` : 'Bez termínu'}
                                    </div>
                                    <div className="text-secondary" style={{ fontSize: '0.85rem' }}>
                                        {describeAssignment(quiz)}
                                    </div>
                                    <div className="text-secondary" style={{ fontSize: '0.85rem' }}>
                                        {formatQuestionCount((quiz.questions || []).length)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <Link to={`/admin/kviz/${quiz.id}`} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                                        Upravit
                                    </Link>
                                    <Link to={`/admin/kviz/${quiz.id}`} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                                        Výsledky
                                    </Link>
                                    <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => duplicateQuiz(quiz)}>
                                        Kopie
                                    </button>
                                    {quiz.status === 'published' && (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.8rem', color: '#E65100', borderColor: '#FFCC80' }}
                                            onClick={() => setConfirmAction({ type: 'close', quiz })}
                                        >
                                            Uzavřít
                                        </button>
                                    )}
                                    {quiz.status === 'draft' && (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.8rem', color: '#c62828', borderColor: '#ffcdd2' }}
                                            onClick={() => setConfirmAction({ type: 'delete', quiz })}
                                        >
                                            Smazat
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
