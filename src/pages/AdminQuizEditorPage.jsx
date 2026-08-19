import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import useQuizzes from '../hooks/useQuizzes';
import useTrainings from '../hooks/useTrainings';
import QuizSettingsForm from '../components/admin/quizzes/QuizSettingsForm';
import QuestionEditor, { emptyQuestion, newId } from '../components/admin/quizzes/QuestionEditor';
import ConfirmModal from '../components/profile/ConfirmModal';

const STATUS_CONFIG = {
  draft: { label: 'Koncept', color: '#546E7A', bg: '#ECEFF1', border: '#B0BEC5' },
  published: { label: 'Aktivní', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  closed: { label: 'Uzavřený', color: '#616161', bg: '#F5F5F5', border: '#BDBDBD' },
};

// Fields owned by this page's quiz patch. `questions` genuinely belongs to
// the quizzes document (id/type/text/options — never a `correct` flag).
// The answer key (correct answers, explanations) is intentionally NOT in
// this list — it lives only in the quizAnswerKeys document and must never
// be folded into a quizzes patch.
const QUIZ_SETTINGS_FIELDS = [
  'title', 'description', 'trainingId', 'assignment', 'deadline',
  'passThreshold', 'maxAttempts', 'timeLimitMinutes',
  'shuffleQuestions', 'shuffleOptions', 'showCorrectAnswers', 'notifyOnPublish',
  'questions',
];

export default function AdminQuizEditorPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const {
    quizzes, loading, canManage, updateQuiz, saveAnswerKey, loadAnswerKey,
    validateForPublish, publishQuiz, closeQuiz, duplicateQuiz, deleteQuiz,
  } = useQuizzes();
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
  const [publishing, setPublishing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm } | null

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

  // Primitives (not the `quiz` object itself, whose identity changes every
  // render) so effect 4 below can depend on them directly.
  const liveStatus = quiz?.status;
  const livePublishedAt = quiz?.publishedAt;
  const liveClosedAt = quiz?.closedAt;

  // 4) Keep status (and its timestamps) mirrored from the live document.
  // Publishing/closing happen through Firestore writes below, and this page
  // deliberately does not resync the rest of the working copy (see effect
  // 2's comment) — but status is not something the admin edits directly, so
  // syncing it here is what flips the form to locked/read-only the instant
  // the write actually lands, with no manual refresh. It also means a
  // publish/close call that fails server-side simply never flips the UI,
  // which is the accurate outcome.
  useEffect(() => {
    if (liveStatus === undefined) return;
    setWorkingQuiz(prev => {
      if (!prev || prev.status === liveStatus) return prev;
      return { ...prev, status: liveStatus, publishedAt: livePublishedAt, closedAt: liveClosedAt };
    });
  }, [liveStatus, livePublishedAt, liveClosedAt]);

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
  // published and closed both freeze the questions (a member may already
  // have attempted them); closed additionally freezes the settings that
  // stay editable while merely published (title, deadline, assignment...).
  const locked = workingQuiz.status !== 'draft';
  const readOnly = workingQuiz.status === 'closed';
  const actionBusy = saving || publishing || closing || duplicating || deleting;

  function handleChange(patch) {
    setWorkingQuiz(prev => ({ ...prev, ...patch }));
  }

  // A question's text/type/options touch the quiz; a type change also wipes
  // that question's answer-key entry (it points at option ids that no
  // longer exist once the options are regenerated) so a stale entry can
  // never make validateForPublish pass while the quiz is actually broken.
  function handleQuestionChange(questionId, patch) {
    setWorkingQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q => (q.id === questionId ? { ...q, ...patch } : q)),
    }));
    if (patch.type) {
      setWorkingAnswerKey(prev => {
        const answers = { ...prev.answers };
        if (patch.type === 'text') {
          answers[questionId] = { autoGraded: false };
        } else {
          delete answers[questionId];
        }
        return { ...prev, answers };
      });
    }
  }

  function handleKeyChange(questionId, correct) {
    setWorkingAnswerKey(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: { correct, autoGraded: true } },
    }));
  }

  function handleExplanationChange(questionId, text) {
    setWorkingAnswerKey(prev => ({
      ...prev,
      explanations: { ...prev.explanations, [questionId]: text },
    }));
  }

  function handleMoveQuestion(questionId, direction) {
    setWorkingQuiz(prev => {
      const questions = [...prev.questions];
      const index = questions.findIndex(q => q.id === questionId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= questions.length) return prev;
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...prev, questions };
    });
  }

  // Duplicating a question must give the copy (and every one of its
  // options) fresh ids, then carry the original's answer-key entry and
  // explanation over to those new ids — including remapping any option ids
  // referenced in `correct` — so the copy has its own independent, valid
  // answer key instead of silently sharing (or losing) the original's.
  function handleDuplicateQuestion(questionId) {
    const original = workingQuiz.questions.find(q => q.id === questionId);
    if (!original) return;

    const idMap = {};
    const options = (original.options || []).map(opt => {
      const id = newId();
      idMap[opt.id] = id;
      return { ...opt, id };
    });
    const duplicated = { ...original, id: newId(), options };

    setWorkingQuiz(prev => {
      const index = prev.questions.findIndex(q => q.id === questionId);
      const questions = [...prev.questions];
      questions.splice(index + 1, 0, duplicated);
      return { ...prev, questions };
    });

    setWorkingAnswerKey(prev => {
      const answers = { ...prev.answers };
      const originalEntry = prev.answers[questionId];
      if (originalEntry) {
        const entry = { ...originalEntry };
        if (Array.isArray(entry.correct)) {
          entry.correct = entry.correct.map(id => idMap[id] || id);
        }
        answers[duplicated.id] = entry;
      }
      const explanations = { ...prev.explanations };
      if (prev.explanations?.[questionId] !== undefined) {
        explanations[duplicated.id] = prev.explanations[questionId];
      }
      return { answers, explanations };
    });
  }

  function handleRemoveQuestion(questionId) {
    setWorkingQuiz(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== questionId),
    }));
    setWorkingAnswerKey(prev => {
      const answers = { ...prev.answers };
      const explanations = { ...prev.explanations };
      delete answers[questionId];
      delete explanations[questionId];
      return { answers, explanations };
    });
  }

  function handleAddQuestion() {
    setWorkingQuiz(prev => ({ ...prev, questions: [...(prev.questions || []), emptyQuestion()] }));
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

  // Save first so validation (and, on success, publication) run against
  // what the admin actually intended to publish rather than stale state —
  // otherwise a quiz could be refused for a problem the admin just fixed,
  // or published without a fix that was never written. `validateForPublish`
  // is called here directly (not left to `publishQuiz`, which only surfaces
  // its first error) so every problem can be shown at once.
  async function handlePublishClick() {
    setPublishing(true);
    try {
      await handleSave();
      const errors = validateForPublish(workingQuiz, workingAnswerKey);
      setValidationErrors(errors);
      if (errors.length) return;
      setConfirmAction({
        message: 'Zveřejnit kvíz? Po zveřejnění už nepůjde měnit otázky.',
        onConfirm: doPublish,
      });
    } finally {
      setPublishing(false);
    }
  }

  // The actual publish call, run only after the confirmation above. If it
  // fails, `publishQuiz` has already toasted the reason; status then simply
  // never flips (see effect 4), so the admin is left looking at an accurate,
  // still-editable draft rather than a UI that claims success it didn't get.
  async function doPublish() {
    setPublishing(true);
    try {
      await publishQuiz(workingQuiz, workingAnswerKey);
    } finally {
      setPublishing(false);
    }
  }

  function handleCloseClick() {
    setConfirmAction({
      message: 'Uzavřít kvíz? Členové ho už nebudou moci vyplnit, výsledky zůstanou zachované.',
      onConfirm: doClose,
    });
  }

  async function doClose() {
    setClosing(true);
    try {
      await closeQuiz(quizId);
    } finally {
      setClosing(false);
    }
  }

  function handleDeleteClick() {
    setConfirmAction({
      message: `Koncept „${workingQuiz.title || '(Bez názvu)'}“ bude trvale smazán.`,
      onConfirm: doDelete,
    });
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteQuiz(quizId);
      navigate('/admin');
    } finally {
      setDeleting(false);
    }
  }

  // Saved first for the same reason as publishing: `duplicateQuiz` copies
  // the answer key straight from Firestore, so an unsaved edit here would
  // otherwise be silently missing from the copy. Skipped for a closed quiz:
  // the form is frozen there (no legitimate unsaved edit can exist), and
  // writing to a closed quiz's own document is exactly what must never
  // happen — closing is meant to leave the record undisturbed.
  async function handleDuplicate() {
    setDuplicating(true);
    try {
      if (workingQuiz.status !== 'closed') {
        await handleSave();
      }
      const newQuizId = await duplicateQuiz(workingQuiz);
      if (newQuizId) navigate(`/admin/kviz/${newQuizId}`);
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="container mt-4 mb-5">
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <Link to="/admin" className="btn btn-secondary mb-3" style={{ display: 'inline-block' }}>← Zpět na kvízy</Link>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{workingQuiz.title || '(Bez názvu)'}</h1>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem',
            borderRadius: '999px', color: statusCfg.color, background: statusCfg.bg, border: `1px solid ${statusCfg.border}`,
          }}>
            {statusCfg.label}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {workingQuiz.status === 'draft' && (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={actionBusy}>
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button className="btn btn-primary" onClick={handlePublishClick} disabled={actionBusy}>
                {publishing ? 'Kontroluji...' : 'Zveřejnit'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ color: '#c62828', borderColor: '#ffcdd2' }}
                onClick={handleDeleteClick}
                disabled={actionBusy}
              >
                {deleting ? 'Mažu...' : 'Smazat koncept'}
              </button>
            </>
          )}
          {workingQuiz.status === 'published' && (
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={actionBusy}>
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
              <button className="btn btn-secondary" onClick={handleDuplicate} disabled={actionBusy}>
                {duplicating ? 'Vytvářím kopii...' : 'Vytvořit kopii'}
              </button>
              <button
                className="btn btn-secondary"
                style={{ color: '#E65100', borderColor: '#FFCC80' }}
                onClick={handleCloseClick}
                disabled={actionBusy}
              >
                {closing ? 'Uzavírám...' : 'Uzavřít'}
              </button>
            </>
          )}
          {workingQuiz.status === 'closed' && (
            <button className="btn btn-secondary" onClick={handleDuplicate} disabled={actionBusy}>
              {duplicating ? 'Vytvářím kopii...' : 'Vytvořit kopii'}
            </button>
          )}
        </div>
      </div>

      {workingQuiz.status === 'draft' && validationErrors.length > 0 && (
        <div className="card mb-4" style={{
          padding: '1rem 1.25rem', background: '#FFEBEE', border: '1px solid #EF9A9A', color: '#B71C1C',
        }}>
          <strong style={{ display: 'block', marginBottom: '0.4rem' }}>Kvíz nelze zveřejnit:</strong>
          <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
            {validationErrors.map((error, index) => <li key={index}>{error}</li>)}
          </ul>
        </div>
      )}

      <div className="card mb-4" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginTop: 0, marginBottom: '1rem' }}>Nastavení</h2>
        {readOnly && (
          <p style={{
            fontSize: '0.85rem', color: '#616161', background: '#F5F5F5',
            border: '1px solid #BDBDBD', borderRadius: '6px', padding: '0.5rem 0.75rem',
          }}>
            Kvíz je uzavřený — nastavení je jen ke čtení.
          </p>
        )}
        <div style={readOnly ? { opacity: 0.65 } : undefined}>
          <QuizSettingsForm
            quiz={workingQuiz}
            onChange={handleChange}
            disabled={locked}
            readOnly={readOnly}
            trainings={trainings}
          />
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>Otázky</h2>
        {locked && (
          <p style={{
            fontSize: '0.85rem', color: '#E65100', background: '#FFF3E0',
            border: '1px solid #FFCC80', borderRadius: '6px', padding: '0.5rem 0.75rem',
          }}>
            {readOnly ? 'Kvíz je uzavřený — otázky už nelze měnit.' : 'Kvíz je zveřejněný — otázky už nelze měnit.'}
          </p>
        )}

        {(workingQuiz.questions || []).map((question, index) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={index}
            keyEntry={workingAnswerKey.answers?.[question.id]}
            explanation={workingAnswerKey.explanations?.[question.id]}
            onChange={patch => handleQuestionChange(question.id, patch)}
            onKeyChange={correct => handleKeyChange(question.id, correct)}
            onExplanationChange={text => handleExplanationChange(question.id, text)}
            onMove={direction => handleMoveQuestion(question.id, direction)}
            onDuplicate={() => handleDuplicateQuestion(question.id)}
            onRemove={() => handleRemoveQuestion(question.id)}
            disabled={locked}
            isFirst={index === 0}
            isLast={index === workingQuiz.questions.length - 1}
          />
        ))}

        <button className="btn btn-secondary" onClick={handleAddQuestion} disabled={locked}>
          + Přidat otázku
        </button>
      </div>
    </div>
  );
}
