import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import useMyQuizzes from '../hooks/useMyQuizzes';
import useQuizAttempt from '../hooks/useQuizAttempt';
import QuizIntro from '../components/quizzes/QuizIntro';
import QuestionRenderer from '../components/quizzes/QuestionRenderer';
import QuizTimer from '../components/quizzes/QuizTimer';
import QuizResultView from '../components/quizzes/QuizResultView';
import ConfirmModal from '../components/profile/ConfirmModal';
import { MEMBER_STATUS } from '../../shared/quizStatus.js';
import { pluralize } from '../utils/pluralize.js';

// Nenápadný řádek nad otázkami — jediné místo, kde se člen dozví, jestli je
// jeho rozepsaná odpověď skutečně v bezpečí. `idle` (než cokoliv upraví) se
// nezobrazuje vůbec, aby řádek nenavykl na text, který ještě nic neznamená.
const SAVE_STATE_CONFIG = {
  saving: { text: 'Ukládám…', color: 'var(--text-secondary)' },
  saved: { text: 'Uloženo', color: 'var(--text-secondary)' },
  error: { text: 'Odpověď se nepodařilo uložit — zkontrolujte připojení.', color: '#C62828' },
};

// `canStart` (z useMyQuizzes) je false ze čtyř různých důvodů, které member
// nesmí vidět pod jedním textem ("vyčerpali jste pokusy" by byla lež pro
// toho, kdo kvíz už splnil nebo čeká na vyhodnocení). Pořadí zrcadlí, jak
// canStart svoje podmínky vyhodnocuje (myStatus nejdřív), takže např. člen,
// který už prošel na uzavřeném kvízu, uvidí "splnili", ne "uzavřen".
function deriveBlockReason(myQuiz, quiz) {
  if (myQuiz.myStatus === MEMBER_STATUS.PASSED) return 'passed';
  if (myQuiz.myStatus === MEMBER_STATUS.PENDING_REVIEW) return 'pending_review';
  if (quiz.status === 'closed') return 'closed';
  return 'exhausted';
}

// Otázka se počítá jako zodpovězená podle svého typu — `[]`/`undefined` u
// single/multi, chybějící boolean a prázdný/whitespace text se počítají jako
// nezodpovězené; `false` u boolean je platná odpověď, ne "nic".
function isAnswered(question, value) {
  if (question.type === 'boolean') return value === true || value === false;
  if (question.type === 'text') return typeof value === 'string' && value.trim().length > 0;
  return Array.isArray(value) && value.length > 0;
}

// Nejnovější odevzdaný (ne rozpracovaný) pokus tohoto člena na tento kvíz —
// zdroj pro zobrazení výsledku po znovunačtení stránky, kdy `result`
// z čerstvého `submitAttempt` v hooku už není k dispozici (nové sezení).
function latestCompletedAttempt(attempts) {
  const completed = attempts.filter(a => a.status !== 'in_progress');
  if (!completed.length) return null;
  return completed.reduce((best, a) => (
    (a.attemptNumber || 0) > (best.attemptNumber || 0) ? a : best
  ));
}

export default function QuizTakePage() {
  const { quizId } = useParams();
  const { myQuizzes, loading: myQuizzesLoading } = useMyQuizzes();
  const {
    quiz, attempt, attempts, loading: attemptLoading, error, starting, startAttempt, setAnswer,
    saveState, submitting, submitAttempt, result, submittedAttempt,
  } = useQuizAttempt(quizId);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Zavře potvrzovací dialog, kdykoliv se rozpracovaný pokus změní pod rukama
  // — typicky auto-odeslání po vypršení limitu, které odešle kvíz bez ptaní
  // (viz `handleExpire`) i s otevřeným dialogem. Bez tohoto resetu by
  // `confirmSubmit` zůstal `true` a po pozdějším "Zkusit znovu" by se dialog
  // s nulovým/zastaralým počtem nezodpovězených otázek objevil znovu sám,
  // hned při vykreslení nového pokusu. Přenastavení proběhne přímo v těle
  // komponenty (ne v efektu) — doporučený React vzor na "přenastavení stavu
  // při změně vstupu".
  const currentAttemptId = attempt?.id ?? null;
  const [seenAttemptId, setSeenAttemptId] = useState(currentAttemptId);
  if (currentAttemptId !== seenAttemptId) {
    setSeenAttemptId(currentAttemptId);
    setConfirmSubmit(false);
  }

  const loading = myQuizzesLoading || attemptLoading;
  // myQuizzes už obsahuje jen kvízy přiřazené tomuto členovi (nebo takové,
  // na které už má alespoň jeden pokus) — chybějící záznam tedy znamená
  // "nepřiřazeno", stejně jako smazaný/neexistující kvíz.
  const myQuiz = myQuizzes.find(q => q.id === quizId);

  if (loading) {
    return <div className="container mt-4 text-center">Načítám kvíz...</div>;
  }

  if (!myQuiz || !quiz) {
    return (
      <div className="container mt-4 mb-5">
        <p>Kvíz není dostupný.</p>
        <Link to="/skoleni" className="btn btn-secondary" style={{ display: 'inline-block' }}>Zpět na Školení</Link>
      </div>
    );
  }

  if (attempt) {
    // Otázky se vykreslují v pořadí `attempt.order.questionIds` (a jejich
    // volby v pořadí `attempt.order.optionOrder[questionId]`), ne v pořadí z
    // dokumentu kvízu — to pořadí je zamíchané jednou při zahájení pokusu
    // (úloha 11) a musí zůstat stejné napříč znovunačtením stránky.
    const questionIds = attempt.order?.questionIds || [];
    const questionsById = new Map((quiz.questions || []).map(q => [q.id, q]));
    const questions = questionIds.map(id => questionsById.get(id)).filter(Boolean);
    const saveInfo = SAVE_STATE_CONFIG[saveState];
    const unanswered = questions.filter(q => !isAnswered(q, attempt.answers?.[q.id])).length;

    function openConfirm() {
      setConfirmSubmit(true);
    }

    // Po vypršení limitu se odesílá bez ptaní — `submitAttempt` sám hlídá
    // (přes `submittingRef`), že dvojí volání (např. auto-odeslání těsně po
    // ručním kliknutí na Odeslat) neprojde dvakrát.
    function handleExpire() {
      submitAttempt();
    }

    return (
      <div className="container mt-4 mb-5">
        {confirmSubmit && (
          <ConfirmModal
            message={unanswered > 0
              ? `Nezodpověděli jste ${unanswered} ${pluralize(unanswered, 'otázku', 'otázky', 'otázek')}. Opravdu odeslat?`
              : 'Odeslat kvíz k vyhodnocení?'}
            onConfirm={submitAttempt}
            onCancel={() => setConfirmSubmit(false)}
          />
        )}

        <div className="card mb-3" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>{quiz.title}</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Pokus č. {attempt.attemptNumber}</p>
          </div>
          <QuizTimer
            startedAt={attempt.startedAt}
            timeLimitMinutes={quiz.timeLimitMinutes}
            onExpire={handleExpire}
          />
        </div>

        <div style={{ minHeight: '1.2rem', marginBottom: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>
          {saveInfo && <span style={{ color: saveInfo.color }}>{saveInfo.text}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.map((question, index) => (
            <div key={question.id} className="card" style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Otázka {index + 1} z {questions.length}
              </p>
              <p style={{ margin: '0 0 0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {question.text}
              </p>
              <QuestionRenderer
                question={question}
                order={attempt.order}
                value={attempt.answers?.[question.id]}
                onChange={value => setAnswer(question.id, value)}
                disabled={submitting}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <button type="button" className="btn btn-primary" onClick={openConfirm} disabled={submitting}>
            {submitting ? 'Odesílám…' : 'Odeslat'}
          </button>
        </div>
      </div>
    );
  }

  // Žádný rozpracovaný pokus. Buď je po ruce čerstvý výsledek z tohoto
  // sezení (`result`/`submittedAttempt` z právě dokončeného `submitAttempt`),
  // nebo aspoň dřív odevzdaný pokus z historie (`attempts`) — v obou
  // případech má smysl ukázat výsledek místo úvodní karty. Teprve když
  // člen na tento kvíz ještě žádný pokus neměl, přijde na řadu `QuizIntro`.
  const resultAttempt = submittedAttempt || latestCompletedAttempt(attempts);
  if (resultAttempt) {
    return (
      <div className="container mt-4 mb-5">
        <QuizResultView
          quiz={quiz}
          attempt={resultAttempt}
          result={submittedAttempt ? result : null}
          onRetry={startAttempt}
          retrying={starting}
          // `myQuiz.canStart` (z `useMyQuizzes`) je jediný autoritativní zdroj
          // pravidla "smí člen začít další pokus" — započítává i uzavření
          // kvízu a čekání na ruční vyhodnocení. `QuizResultView` ho nesmí
          // znovu odvozovat jen z `status === 'failed'`/počtu pokusů, jinak
          // by ukázal fungující Zkusit znovu i na kvízu, který admin mezitím
          // uzavřel. `startAttempt` má navíc svou vlastní obrannou kontrolu
          // stavu kvízu (viz `useQuizAttempt`), ale UI musí gatovat tlačítko
          // správně samo — schovaný, "mrtvý" click by byl matoucí.
          canRetry={myQuiz.canStart}
        />
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      {error && (
        <p style={{ color: '#C62828', marginBottom: '0.75rem', fontWeight: 600 }}>{error}</p>
      )}
      <QuizIntro
        quiz={quiz}
        attemptsUsed={myQuiz.attemptsUsed}
        canStart={myQuiz.canStart}
        blockReason={myQuiz.canStart ? null : deriveBlockReason(myQuiz, quiz)}
        onStart={startAttempt}
        starting={starting}
      />
    </div>
  );
}
