import React from 'react';
import { Link } from 'react-router-dom';

// Stejná paleta jako `QuizCard` (STATUS_CONFIG) — verdikt na výsledkové
// stránce a štítek na kartě kvízu musí vypadat jako jedna barevná soustava.
const VERDICT_CONFIG = {
  passed: { label: 'Splnil', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  failed: { label: 'Nesplnil', color: '#C62828', bg: '#FFEBEE', border: '#FFCDD2' },
  pending_review: { label: 'Čeká na vyhodnocení', color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9' },
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

  const hasBreakdown = Boolean(result?.perQuestion);

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
              borderRadius: '999px', color: '#E65100', background: '#FFF3E0',
              border: '1px solid #FFCC80', whiteSpace: 'nowrap',
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

            const isCorrect = result.perQuestion[questionId];
            const explanation = result.explanations?.[questionId];
            const keyEntry = result.correctAnswers?.[questionId];

            let borderColor = '#9E9E9E';
            let stateLabel = 'Hodnotí velitel';
            let stateColor = 'var(--text-secondary)';
            if (isCorrect === true) { borderColor = '#2E7D32'; stateLabel = 'Správně'; stateColor = '#2E7D32'; }
            else if (isCorrect === false) { borderColor = '#C62828'; stateLabel = 'Špatně'; stateColor = '#C62828'; }

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
            Správné odpovědi se u tohoto kvízu nezobrazují.
          </p>
        </div>
      )}
    </div>
  );
}
