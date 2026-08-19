import React from 'react';
import { Link, useParams } from 'react-router-dom';
import useMyQuizzes from '../hooks/useMyQuizzes';
import useQuizAttempt from '../hooks/useQuizAttempt';
import QuizIntro from '../components/quizzes/QuizIntro';

export default function QuizTakePage() {
  const { quizId } = useParams();
  const { myQuizzes, loading: myQuizzesLoading } = useMyQuizzes();
  const {
    quiz, attempt, loading: attemptLoading, error, starting, startAttempt,
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
    // Vyplňování otázek rozpracovaného pokusu doplní úloha 12.
    return (
      <div className="container mt-4 mb-5">
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>{quiz.title}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Rozpracovaný pokus č. {attempt.attemptNumber} — vyplňování otázek bude doplněno.
          </p>
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
        onStart={startAttempt}
        starting={starting}
      />
    </div>
  );
}
