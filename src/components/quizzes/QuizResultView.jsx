import React from 'react';
import { Link } from 'react-router-dom';

// Stejná paleta jako `QuizCard` (STATUS_CONFIG) — verdikt na výsledkové
// stránce a štítek na kartě kvízu musí vypadat jako jedna barevná soustava.
const VERDICT_CONFIG = {
  passed: { label: 'Splnil', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
  failed: { label: 'Nesplnil', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
  pending_review: { label: 'Čeká na vyhodnocení', color: 'var(--info-text)', bg: 'var(--info-bg)', border: 'var(--info-border)' },
};

function formatAnswerValue(question, value) {
  const isEmpty = value === undefined || value === null || value === ''
    || (Array.isArray(value) && value.length === 0);
  if (isEmpty) return '(bez odpovědi)';

  if (question.type === 'boolean') return value ? 'Ano' : 'Ne';
  if (question.type === 'text') return value;

  const ids = Array.isArray(value) ? value : [value];
  const textById = new Map((question.options || []).map(o => [o.id, o.text]));
  return ids.map(id => textById.get(id) || id).join(', ');
}

/**
 * Výsledek pokusu — velké skóre, štítek splnění, hranice úspěšnosti, případný
 * štítek opožděného odevzdání, rozbor po otázkách (jen když ho server poslal)
 * a tlačítko na nový pokus.
 *
 * `result` je buď čerstvá odpověď `/api/quiz-submit` (právě odevzdaný pokus),
 * nebo `null`, když stránka jen zobrazuje dřív odevzdaný pokus po
 * znovunačtení — v tom případě se skóre/verdikt/pozdní odevzdání čtou přímo
 * z `attempt` (uloženy tam serverem při odevzdání), ale rozbor po otázkách
 * `attempt` neobsahuje (server ho nikam neukládá, aby ho člen nemohl získat
 * jinak než jednorázovou odpovědí na odeslání) — proto se v tom případě vždy
 * ukáže jen informace, že se správné odpovědi nezobrazují.
 *
 * `onRetry`/`canRetry` jsou volitelné (nad rámec `{ quiz, attempt, result }`
 * z úlohy): když je `canRetry` pravdivé a `onRetry` je zadané, zobrazí se
 * tlačítko Zkusit znovu, které `onRetry` zavolá — stránka `QuizTakePage` sem
 * posílá `startAttempt` z `useQuizAttempt`. Bez `onRetry` se tlačítko
 * nezobrazí vůbec.
 *
 * `canRetry` se tady záměrně NEodvozuje znovu z `status`/`maxAttempts` —
 * `useMyQuizzes` už jednou spočítal autoritativní `myQuiz.canStart`
 * (zahrnuje i uzavření kvízu a čekání na ruční vyhodnocení), a volající
 * stránka ho posílá přímo. Druhá nezávislá kopie stejného pravidla by se
 * dřív nebo později rozešla s tou první — přesně to se stalo predtím, kdy
 * tahle komponenta ukazovala fungující Zkusit znovu i na kvízu, který admin
 * mezitím uzavřel.
 */
export default function QuizResultView({
  quiz, attempt, result, onRetry, retrying, canRetry,
}) {
  if (!attempt) return null;

  const status = result ? result.status : attempt.status;
  const scorePercent = result ? result.scorePercent : attempt.scorePercent;
  const isLate = Boolean(result ? result.isLate : attempt.isLate);
  const verdict = VERDICT_CONFIG[status] || VERDICT_CONFIG.failed;

  const questionsById = new Map((quiz.questions || []).map(q => [q.id, q]));
  const questionIds = attempt.order?.questionIds?.length
    ? attempt.order.questionIds
    : (quiz.questions || []).map(q => q.id);

  // Rozbor bereme buď z čerstvé odpovědi serveru (právě odevzdáno), nebo
  // z toho, co server uložil k pokusu (návrat na výsledek později).
  const review = result?.perQuestion ? result : attempt.review;
  const hasBreakdown = Boolean(review?.perQuestion);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>{quiz.title}</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '2.6rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {typeof scorePercent === 'number' ? `${scorePercent} %` : '—'}
          </div>
          <span style={{
            fontSize: '0.85rem', fontWeight: 700, padding: '0.3rem 0.75rem',
            borderRadius: '999px', color: verdict.color, background: verdict.bg,
            border: `1px solid ${verdict.border}`, whiteSpace: 'nowrap',
          }}
          >
            {verdict.label}
          </span>
          {isLate && (
            <span style={{
              fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.65rem',
              borderRadius: '999px', color: 'var(--warning-dark)', background: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)', whiteSpace: 'nowrap',
            }}
            >
              Odevzdáno po termínu
            </span>
          )}
        </div>

        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Hranice úspěšnosti: {quiz.passThreshold} %
        </p>

        {status === 'pending_review' && (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Kvíz obsahuje otevřené otázky, které musí zkontrolovat velitel — výsledek se zobrazí
            po jejich vyhodnocení.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {canRetry && onRetry && (
            <button type="button" className="btn btn-primary" onClick={onRetry} disabled={retrying}>
              {retrying ? 'Zahajuji…' : 'Zkusit znovu'}
            </button>
          )}
          <Link to="/skoleni" className="btn btn-secondary">Zpět na školení</Link>
        </div>
      </div>

      {hasBreakdown ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {questionIds.map((questionId, index) => {
            const question = questionsById.get(questionId);
            if (!question) return null;

            const isCorrect = review.perQuestion[questionId];
            const explanation = review.explanations?.[questionId];
            const keyEntry = review.correctAnswers?.[questionId];

            let borderColor = 'var(--text-gray)';
            let stateLabel = 'Hodnotí velitel';
            let stateColor = 'var(--text-secondary)';
            if (isCorrect === true) { borderColor = 'var(--success-text)'; stateLabel = 'Správně'; stateColor = 'var(--success-text)'; }
            else if (isCorrect === false) { borderColor = 'var(--danger-text)'; stateLabel = 'Špatně'; stateColor = 'var(--danger-text)'; }

            return (
              <div key={questionId} className="card" style={{ padding: '1rem 1.25rem', borderLeft: `4px solid ${borderColor}` }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {index + 1}. {question.text}
                </p>
                <p style={{ margin: '0 0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Vaše odpověď: <strong style={{ color: 'var(--text-primary)' }}>{formatAnswerValue(question, attempt.answers?.[questionId])}</strong>
                </p>
                {question.type !== 'text' && (
                  <p style={{ margin: '0 0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Správná odpověď: <strong style={{ color: 'var(--text-primary)' }}>{formatAnswerValue(question, keyEntry?.correct)}</strong>
                  </p>
                )}
                {explanation && (
                  <p style={{ margin: '0 0 0.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {explanation}
                  </p>
                )}
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: stateColor }}>{stateLabel}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {quiz.showCorrectAnswers
              ? 'Rozbor odpovědí u tohoto pokusu není k dispozici — byl odevzdán dříve, než se začal ukládat.'
              : 'Správné odpovědi se u tohoto kvízu nezobrazují.'}
          </p>
        </div>
      )}
    </div>
  );
}
