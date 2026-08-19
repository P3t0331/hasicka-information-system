import React from 'react';
import { Link, useParams } from 'react-router-dom';
import useMyQuizzes from '../hooks/useMyQuizzes';
import useQuizAttempt from '../hooks/useQuizAttempt';
import QuizIntro from '../components/quizzes/QuizIntro';
import QuestionRenderer from '../components/quizzes/QuestionRenderer';
import { MEMBER_STATUS } from '../../shared/quizStatus.js';

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

export default function QuizTakePage() {
  const { quizId } = useParams();
  const { myQuizzes, loading: myQuizzesLoading } = useMyQuizzes();
  const {
    quiz, attempt, loading: attemptLoading, error, starting, startAttempt, setAnswer, saveState,
  } = useQuizAttempt(quizId);

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

    return (
      <div className="container mt-4 mb-5">
        <div className="card mb-3" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>{quiz.title}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Pokus č. {attempt.attemptNumber}</p>
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
                disabled={false}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          {/* Chování tlačítka (odeslání pokusu) doplní úloha 13. */}
          <button type="button" className="btn btn-primary">Odeslat</button>
        </div>
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
