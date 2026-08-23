import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logAction } from '../../utils/logger';
import useQuizzes, { sendQuizNotification } from '../../hooks/useQuizzes';
import useQuizResults from '../../hooks/useQuizResults';
import QuizResultsTable from './quizzes/QuizResultsTable';
import QuizAttemptDetail from './quizzes/QuizAttemptDetail';
import QuestionStats from './quizzes/QuestionStats';
import { bestAttempt, MEMBER_STATUS } from '../../../shared/quizStatus.js';
import { pluralize } from '../../utils/pluralize';

const STATUS_CONFIG = {
    draft:     { label: 'Koncept', color: 'var(--neutral)', bg: 'var(--neutral-bg)', border: 'var(--neutral-border)' },
    published: { label: 'Aktivní', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
    closed:    { label: 'Uzavřený', color: 'var(--text-secondary)', bg: 'var(--surface-alt)', border: 'var(--border-strong)' },
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

// Který pokus se v detailu (úloha 15) ukáže jako výchozí, když na řádek
// klikne velitel. Řádek může být klikací i s víc pokusy (viz `hasSubmittedAttempt`
// v QuizResultsTable) — mezi odevzdanými pokusy se vybírá ten, na kterém
// aktuálně "visí" práce (čekající na vyhodnocení), jinak nejlepší odevzdaný
// pokus (co určuje zobrazené skóre v tabulce), a jako poslední záchrana
// nejnovější odevzdaný pokus podle čísla pokusu.
function pickDefaultAttemptId(attempts) {
    const submitted = (attempts || []).filter(a => a.status !== 'in_progress');
    if (!submitted.length) return null;
    const pending = submitted.find(a => a.status === 'pending_review');
    if (pending) return pending.id;
    const best = bestAttempt(submitted);
    if (best) return best.id;
    const latest = submitted.reduce(
        (acc, a) => (!acc || (a.attemptNumber || 0) > (acc.attemptNumber || 0) ? a : acc),
        null,
    );
    return latest?.id || null;
}

// Název jednotky pro záhlaví tiskového protokolu (úloha 17) — uložen v
// `settings/unit`, stejným vzorem (onSnapshot + setDoc na jeden dokument)
// jako `settings/importantLinks` v LinksTab.jsx. Jde o jediné pole, proto
// zůstává kompaktní řádek přímo v záložce Kvízy, ne samostatná podstránka.
function UnitNameRow() {
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const [name, setName] = useState('');
    const [loaded, setLoaded] = useState(false);
    const [draft, setDraft] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'unit'), (snap) => {
            const value = snap.exists() ? (snap.data().name || '') : '';
            setName(value);
            setDraft(value);
            setLoaded(true);
        });
        return unsub;
    }, []);

    async function handleSave() {
        const trimmed = draft.trim();
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'unit'), { name: trimmed });
            const actorName = userData ? `${userData.firstName} ${userData.lastName}`.trim() : '';
            logAction(db, currentUser.uid, actorName, 'ADMIN_UPDATED_UNIT_NAME', 'admin', `Nastaven název jednotky: „${trimmed}“`);
            addToast('success', 'Název jednotky uložen.');
        } catch {
            addToast('error', 'Chyba při ukládání názvu jednotky.');
        } finally {
            setSaving(false);
        }
    }

    if (!loaded) return null;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <label htmlFor="unit-name-input" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Název jednotky (pro tiskový protokol):
            </label>
            <input
                id="unit-name-input"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="např. Sbor dobrovolných hasičů…"
                style={{ flex: '1 1 260px', minWidth: '200px', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: '8px' }}
            />
            <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem' }}
                disabled={saving || draft.trim() === name}
                onClick={handleSave}
            >
                Uložit
            </button>
        </div>
    );
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
    const { currentUser, userData } = useAuth();
    const { addToast } = useToast();
    const actorName = userData ? `${userData.firstName} ${userData.lastName}`.trim() : '';
    const { quizzes, loading, canManage, isAdmin, createQuiz, duplicateQuiz, closeQuiz, deleteQuiz, countQuizAttempts } = useQuizzes();

    const [statusFilter, setStatusFilter] = useState('published');
    const [creating, setCreating] = useState(false);
    const [confirmAction, setConfirmAction] = useState(null); // { type: 'close' | 'delete', quiz, attemptCount }

    // U zveřejněného nebo uzavřeného kvízu si nejdřív zjistíme, kolik pokusů
    // se smazáním ztratí — admin to má vidět dřív, než potvrdí.
    async function requestDelete(quiz) {
        if (quiz.status === 'draft') {
            setConfirmAction({ type: 'delete', quiz, attemptCount: 0 });
            return;
        }
        const attemptCount = await countQuizAttempts(quiz.id);
        setConfirmAction({ type: 'delete', quiz, attemptCount });
    }
    const [selectedQuizId, setSelectedQuizId] = useState(null);
    // Potvrzovací dialog ruční připomínky (úloha 20) — jde o notifikaci
    // směrem ven k lidem, nesmí odejít jedním klikem bez potvrzení.
    const [reminderConfirmOpen, setReminderConfirmOpen] = useState(false);
    const [sendingReminder, setSendingReminder] = useState(false);
    // Jen uid + id pokusu, ne celý objekt řádku/pokusu — ty se čtou znovu z
    // `results.rows`/`results.attempts` při každém renderu (viz níže), takže
    // detail vždycky ukazuje aktuální (živá onSnapshot) data, ne snímek z
    // okamžiku kliknutí. Bez toho by hodnocení druhé textové otázky mohlo
    // zápisem cílit na pokus tak, jak vypadal PŘED prvním hodnocením.
    const [selectedMemberUid, setSelectedMemberUid] = useState(null);
    const [selectedAttemptId, setSelectedAttemptId] = useState(null);
    // Která záložka detailu kvízu je aktivní (úloha 16) — 'results' je výchozí
    // pohled, stejný jako před přidáním statistik.
    const [detailTab, setDetailTab] = useState('results');

    // Volá se bezpodmínečně (hook sám ošetří selectedQuizId === null), aby pořadí
    // hooků zůstalo napříč rendery stejné bez ohledu na to, jestli je detail otevřený.
    const results = useQuizResults(selectedQuizId);

    const selectedRow = selectedMemberUid
        ? results.rows.find(r => r.uid === selectedMemberUid) || null
        : null;
    const selectedAttempt = selectedRow
        ? (selectedRow.attempts || []).find(a => a.id === selectedAttemptId) || null
        : null;

    // Komu jde ruční připomínka (úloha 20): všichni, kdo kvíz NEsplnili — tedy
    // i ti, kdo ho ještě vůbec nezačali (NOT_STARTED), ne jen ti, co ho
    // rozpracovali nebo neuspěli. Kdo je PASSED, ten se do seznamu nedostane.
    const notPassedRows = results.rows.filter(r => r.status !== MEMBER_STATUS.PASSED);

    async function handleSendReminder() {
        if (!results.quiz || notPassedRows.length === 0) { setReminderConfirmOpen(false); return; }
        setSendingReminder(true);
        try {
            await sendQuizNotification({
                title: 'Připomínka kvízu',
                body: `${results.quiz.title} — termín do ${results.quiz.deadline}`,
                targetUserIds: notPassedRows.map(r => r.uid),
            });
            logAction(db, currentUser.uid, actorName, 'SENT_QUIZ_REMINDER', 'admin',
                `Odeslal připomínku kvízu „${results.quiz.title}“ ${notPassedRows.length} členům`);
            addToast('success', `Připomínka odeslána (${notPassedRows.length} ${pluralize(notPassedRows.length, 'členovi', 'členům', 'členům')}).`);
        } finally {
            setSendingReminder(false);
            setReminderConfirmOpen(false);
        }
    }

    function handleSelectMember(row) {
        setSelectedMemberUid(row.uid);
        setSelectedAttemptId(pickDefaultAttemptId(row.attempts));
    }

    function handleBackToResults() {
        setSelectedMemberUid(null);
        setSelectedAttemptId(null);
    }

    function handleBackToList() {
        setSelectedQuizId(null);
        setSelectedMemberUid(null);
        setSelectedAttemptId(null);
        setDetailTab('results');
    }

    function handleOpenResults(quizId) {
        setSelectedQuizId(quizId);
        setDetailTab('results');
    }

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Načítání kvízů…</div>;
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

    if (selectedQuizId) {
        // Detail pokusu (ruční hodnocení) se ukáže, jakmile je vybraný člen i
        // pokus a data už jsou načtená. `selectedAttempt` se dohledává výše z
        // živého `results.rows`/`row.attempts` podle uid+id, takže po odeslání
        // hodnocení (úprava dokumentu pokusu) se detail překreslí s novým
        // skóre/stavem, aniž by bylo potřeba cokoli tady ručně synchronizovat.
        if (!results.loading && selectedRow && selectedAttempt) {
            return (
                <QuizAttemptDetail
                    quiz={results.quiz}
                    answerKey={results.answerKey}
                    attempt={selectedAttempt}
                    attempts={selectedRow.attempts}
                    onSelectAttempt={setSelectedAttemptId}
                    onGrade={(questionId, points) => results.gradeAnswer(selectedAttempt, questionId, points)}
                    onBack={handleBackToResults}
                />
            );
        }

        return (
            <div>
                <button
                    type="button"
                    onClick={handleBackToList}
                    style={{
                        background: 'none', border: 'none', padding: 0, marginBottom: '1rem',
                        color: 'var(--primary-red)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                    }}
                >
                    ← Zpět na seznam
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                        Výsledky: {results.quiz?.title || '…'}
                    </h2>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.85rem' }}
                        onClick={() => window.open(`/kviz/${selectedQuizId}/protokol`, '_blank')}
                    >
                        Protokol
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <button
                        type="button"
                        onClick={() => setDetailTab('results')}
                        className={`btn ${detailTab === 'results' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.85rem' }}
                    >
                        Výsledky
                    </button>
                    <button
                        type="button"
                        onClick={() => setDetailTab('stats')}
                        className={`btn ${detailTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ fontSize: '0.85rem' }}
                    >
                        Statistika otázek
                    </button>
                </div>

                {/* Potvrzovací dialog ruční připomínky (úloha 20) */}
                {reminderConfirmOpen && (
                    <div
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                            background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                        }}
                        onClick={() => setReminderConfirmOpen(false)}
                    >
                        <div className="card" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', width: '90%', animation: 'fadeIn 0.2s' }}>
                            <h3 style={{ marginTop: 0 }}>Poslat připomínku?</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                                Připomínka bude odeslána {notPassedRows.length} {pluralize(notPassedRows.length, 'členovi', 'členům', 'členům')}, kteří kvíz ještě nesplnili.
                            </p>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReminderConfirmOpen(false)} disabled={sendingReminder}>
                                    Zrušit
                                </button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSendReminder} disabled={sendingReminder}>
                                    Odeslat
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {results.loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Načítání výsledků…</div>
                ) : detailTab === 'results' ? (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                            {notPassedRows.length > 0 ? (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.85rem' }}
                                    onClick={() => setReminderConfirmOpen(true)}
                                    disabled={sendingReminder}
                                >
                                    Poslat připomínku
                                </button>
                            ) : (
                                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.85rem' }} disabled>
                                    Všichni už kvíz splnili.
                                </button>
                            )}
                        </div>
                        <QuizResultsTable
                            rows={results.rows}
                            onSelectMember={handleSelectMember}
                        />
                    </>
                ) : (
                    <QuestionStats
                        quiz={results.quiz}
                        answerKey={results.answerKey}
                        attempts={results.attempts}
                    />
                )}
            </div>
        );
    }

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
                            {confirmAction.type === 'close'
                                ? 'Uzavřít kvíz?'
                                : confirmAction.quiz.status === 'draft' ? 'Smazat koncept?' : 'Nenávratně smazat kvíz?'}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                            {confirmAction.type === 'close'
                                ? <>Kvíz <strong>„{confirmAction.quiz.title}"</strong> bude uzavřen a členové na něj již nebudou moci odpovídat.</>
                                : confirmAction.quiz.status === 'draft'
                                    ? <>Koncept <strong>„{confirmAction.quiz.title}"</strong> bude trvale smazán.</>
                                    : <>
                                        Kvíz <strong>„{confirmAction.quiz.title}"</strong> bude trvale smazán
                                        {confirmAction.attemptCount === null
                                            ? ' i se všemi odevzdanými pokusy.'
                                            : confirmAction.attemptCount === 0
                                                ? '. Zatím na něj nikdo neodpovídal.'
                                                : <> i s <strong>{confirmAction.attemptCount} {pluralize(confirmAction.attemptCount, 'odevzdaným pokusem', 'odevzdanými pokusy', 'odevzdanými pokusy')}</strong>.</>}
                                        {' '}Tím zmizí i doklad o absolvování školení a nelze to vzít zpět.
                                    </>
                            }
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmAction(null)}>Zrušit</button>
                            <button className="btn btn-primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleConfirm}>
                                {confirmAction.type === 'close' ? 'Uzavřít' : 'Smazat'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Kvízy</h2>
                {canManage && (
                    <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>+ Nový kvíz</button>
                )}
            </div>

            {!canManage && (
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Správa kvízů je vyhrazena veliteli jednotky a administrátorům. Zde je můžete pouze prohlížet.
                </p>
            )}

            {canManage && <UnitNameRow />}

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
                    <p style={{ margin: 0, marginBottom: quizzes.length === 0 && canManage ? '1rem' : 0 }}>Zatím žádné kvízy.</p>
                    {quizzes.length === 0 && canManage && (
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
                                    {canManage && (
                                        // Výsledky smí vidět jen správci kvízů — pravidla Firestore stejně
                                        // nepustí ostatní ke čtení všech quizAttempts/quizAnswerKeys kvízu.
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.8rem' }}
                                            onClick={() => handleOpenResults(quiz.id)}
                                        >
                                            Výsledky
                                        </button>
                                    )}
                                    {canManage && (
                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => duplicateQuiz(quiz)}>
                                            Kopie
                                        </button>
                                    )}
                                    {canManage && quiz.status === 'published' && (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.8rem', color: 'var(--warning-dark)', borderColor: 'var(--warning-border)' }}
                                            onClick={() => setConfirmAction({ type: 'close', quiz })}
                                        >
                                            Uzavřít
                                        </button>
                                    )}
                                    {canManage && (quiz.status === 'draft' || isAdmin) && (
                                        <button
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.8rem', color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
                                            onClick={() => requestDelete(quiz)}
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
