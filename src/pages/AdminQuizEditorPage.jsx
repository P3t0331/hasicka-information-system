import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useQuizzes from '../hooks/useQuizzes';
import useTrainings from '../hooks/useTrainings';
import QuizSettingsForm from '../components/admin/quizzes/QuizSettingsForm';

const STATUS_CONFIG = {
  draft: { label: 'Koncept', color: '#546E7A', bg: '#ECEFF1', border: '#B0BEC5' },
  published: { label: 'Aktivní', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  closed: { label: 'Uzavřený', color: '#616161', bg: '#F5F5F5', border: '#BDBDBD' },
};

// Fields owned by the settings form. The answer key (correct answers) is
// intentionally NOT in this list — it lives only in the quizAnswerKeys
// document and must never be folded into a quizzes patch.
const QUIZ_SETTINGS_FIELDS = [
  'title', 'description', 'trainingId', 'assignment', 'deadline',
  'passThreshold', 'maxAttempts', 'timeLimitMinutes',
  'shuffleQuestions', 'shuffleOptions', 'showCorrectAnswers', 'notifyOnPublish',
];

export default function AdminQuizEditorPage() {
  const { quizId } = useParams();
  const { userData } = useAuth();
  const { quizzes, loading, canManage, updateQuiz, saveAnswerKey, loadAnswerKey } = useQuizzes();
  const { upcomingTrainings, pastTrainings } = useTrainings();
  const trainings = [...upcomingTrainings, ...pastTrainings];

  const quiz = quizzes.find(q => q.id === quizId);

  // Local working copies. Seeded once per quizId, then left alone so the
  // admin's in-progress edits survive later onSnapshot updates for the same
  // quiz. Three separate effects below keep two concerns apart: resetting
  // on navigation (sync) vs. seeding once data is available (sync for the
  // quiz, async for the answer key).
  const [workingQuiz, setWorkingQuiz] = useState(null);
  const [workingAnswerKey, setWorkingAnswerKey] = useState(null);
  const [saving, setSaving] = useState(false);

  // useQuizzes() hands back a fresh loadAnswerKey closure on every render.
  // Keep the latest one in a ref instead of an effect dependency, so the
  // fetch effect below only reruns when quizId actually changes — not on
  // every keystroke elsewhere in this component.
  const loadAnswerKeyRef = useRef(loadAnswerKey);
  useEffect(() => { loadAnswerKeyRef.current = loadAnswerKey; }, [loadAnswerKey]);

  // 1) The instant the route's quizId changes, clear both working copies
  // synchronously — before any async work starts — so the loading guard
  // below re-engages until both pieces are freshly seeded for the new id.
  // This is what stops a stale answer key from a previous quiz surviving
  // into the new quiz's state.
  useEffect(() => {
    setWorkingQuiz(null);
    setWorkingAnswerKey(null);
  }, [quizId]);

  // 2) Seed the quiz working copy once `quiz` is available for the current
  // route. The functional update only fills a null (freshly-reset) slot,
  // so later onSnapshot re-emissions for the SAME quiz (new `quiz` object
  // reference, unchanged id) never clobber in-progress edits.
  useEffect(() => {
    if (!quiz) return;
    setWorkingQuiz(prev => prev || {
      ...quiz,
      assignment: {
        mode: quiz.assignment?.mode || 'all',
        roles: [...(quiz.assignment?.roles || [])],
      },
    });
  }, [quiz]);

  // 3) Fetch the answer key exactly once per quizId. `cancelled` is scoped
  // to this specific effect invocation: if the admin navigates to another
  // quiz (or back) before the fetch resolves, the cleanup below flips this
  // invocation's flag, so its eventual response is dropped instead of
  // landing in state for a quiz the page has since moved away from.
  useEffect(() => {
    let cancelled = false;
    loadAnswerKeyRef.current(quizId).then(key => {
      if (!cancelled) setWorkingAnswerKey(key || { answers: {}, explanations: {} });
    });
    return () => { cancelled = true; };
  }, [quizId]);

  if (!userData) return <div className="p-4 text-center">Načítání profilu...</div>;

  if (!canManage) {
    return (
      <div className="page-layout flex-center" style={{ textAlign: 'center', height: '80vh' }}>
        <div className="card" style={{ maxWidth: '400px', borderLeft: '4px solid #d32f2f' }}>
          <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>⛔ Přístup zamítnut</h2>
          <p className="text-secondary">Nemáte dostatečná oprávnění pro přístup do administrace.</p>
          <Link to="/" className="btn btn-secondary mt-3">Zpět na profil</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="container mt-4 text-center">Načítání kvízu...</div>;
  }

  if (!quiz) {
    return (
      <div className="container mt-4 mb-5">
        <Link to="/admin" className="btn btn-secondary mb-3" style={{ display: 'inline-block' }}>← Zpět na kvízy</Link>
        <p>Kvíz nenalezen.</p>
      </div>
    );
  }

  if (!workingQuiz || !workingAnswerKey) {
    return <div className="container mt-4 text-center">Načítání kvízu...</div>;
  }

  const statusCfg = STATUS_CONFIG[workingQuiz.status] || STATUS_CONFIG.draft;
  const locked = workingQuiz.status !== 'draft';

  function handleChange(patch) {
    setWorkingQuiz(prev => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const patch = {};
      QUIZ_SETTINGS_FIELDS.forEach(field => { patch[field] = workingQuiz[field]; });
      await updateQuiz(quizId, patch);
      await saveAnswerKey(quizId, workingAnswerKey);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mt-4 mb-5">
      <Link to="/admin" className="btn btn-secondary mb-3" style={{ display: 'inline-block' }}>← Zpět na kvízy</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{workingQuiz.title || '(Bez názvu)'}</h1>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem',
          borderRadius: '999px', color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
        }}>
          {statusCfg.label}
        </span>
      </div>

      <div className="card mb-4" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>Nastavení</h2>
        <QuizSettingsForm
          quiz={workingQuiz}
          onChange={handleChange}
          disabled={locked}
          trainings={trainings}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Otázky</h2>
        <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Editace otázek bude doplněna.</p>
      </div>
    </div>
  );
}
