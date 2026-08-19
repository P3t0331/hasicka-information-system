import React, { useState } from 'react';
import { MEMBER_STATUS, bestAttempt } from '../../../../shared/quizStatus.js';
import { isAnswerCorrect } from '../../../../shared/quizScoring.js';

// Stejná paleta jako QuizResultsTable/QuizCard — jeden pokus tady může mít
// jen ty stavy, které se ukazují i v tabulce výsledků a na kartě kvízu.
const STATUS_CONFIG = {
  [MEMBER_STATUS.IN_PROGRESS]: { label: 'Rozpracováno', color: '#E65100', bg: '#FFF3E0', border: '#FFCC80' },
  [MEMBER_STATUS.PENDING_REVIEW]: { label: 'Čeká na vyhodnocení', color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9' },
  [MEMBER_STATUS.PASSED]: { label: 'Splnil', color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  [MEMBER_STATUS.FAILED]: { label: 'Nesplnil', color: '#C62828', bg: '#FFEBEE', border: '#FFCDD2' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG[MEMBER_STATUS.PENDING_REVIEW];
  return (
    <span style={{
      fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.7rem',
      borderRadius: '999px', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}

function LateBadge() {
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', marginLeft: '0.5rem',
      borderRadius: '999px', color: '#E65100', background: '#FFF3E0', border: '1px solid #FFCC80',
      whiteSpace: 'nowrap',
    }}>
      Po termínu
    </span>
  );
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('cs-CZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Stejná logika jako `formatAnswerValue` v src/components/quizzes/QuizResultView.jsx
// (member-facing výsledek) — duplikováno záměrně, obě komponenty jsou v jiné
// části stromu a interface téhle komponenty s tou druhou nic nesdílí.
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

function formatAttemptCount(n) {
  if (n === 1) return '1. pokus';
  return `${n}. pokus`;
}

/**
 * Detail jednoho pokusu (úloha 15): hlavička s identifikací člena a pokusu,
 * přepínač mezi pokusy stejného člena (když jich má víc) a rozpis otázek se
 * správnou odpovědí z klíče a ruční hodnocení textových otázek.
 *
 * Otázky se vypisují ve stálém pořadí `quiz.questions` (autorské pořadí), NE
 * v `attempt.order.questionIds` (to je jen pořadí, ve kterém je viděl člen
 * kvůli zamíchání) — velitel čte záznam, ne vyplňuje kvíz, takže stálé
 * pořadí je tu čitelnější. Odpověď člena i správná odpověď z klíče se vždy
 * dohledávají podle `question.id`, nikdy podle pozice.
 *
 * `attempt` je pokus, který se právě zobrazuje (musí patřit členovi, jehož
 * `attempts` sem přišly) — grading (`onGrade`) vždy cílí na tenhle pokus, ne
 * na nejnovější/nejlepší z `attempts`. `attempts` slouží jen přepínači nahoře;
 * `onSelectAttempt(attemptId)` mění, který pokus je `attempt`.
 */
export default function QuizAttemptDetail({
  quiz, answerKey, attempt, attempts, onSelectAttempt, onGrade, onBack,
}) {
  const [gradingQuestionId, setGradingQuestionId] = useState(null);

  if (!quiz || !attempt) return null;

  const answerKeyAnswers = answerKey?.answers || {};
  const answerKeyExplanations = answerKey?.explanations || {};

  const otherAttempts = (attempts || []).filter(a => a.status !== 'in_progress');
  const sortedAttempts = [...otherAttempts].sort((a, b) => (a.attemptNumber || 0) - (b.attemptNumber || 0));
  const bestId = bestAttempt(sortedAttempts)?.id || null;

  async function handleGrade(questionId, points) {
    if (gradingQuestionId) return;
    setGradingQuestionId(questionId);
    try {
      await onGrade(questionId, points);
    } finally {
      setGradingQuestionId(null);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        style={{
          background: 'none', border: 'none', padding: 0, marginBottom: '1rem',
          color: 'var(--primary-red)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
        }}
      >
        ← Zpět na výsledky
      </button>

      {sortedAttempts.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          {sortedAttempts.map((a) => {
            const active = a.id === attempt.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelectAttempt(a.id)}
                className={`btn ${active ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem' }}
              >
                {formatAttemptCount(a.attemptNumber)}
                {a.id === bestId ? ' ★ Nejlepší' : ''}
              </button>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
              {attempt.userName || 'Neznámý člen'}
            </h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
              {formatAttemptCount(attempt.attemptNumber)} · Odevzdáno {formatDateTime(attempt.submittedAt)}
              {attempt.isLate && <LateBadge />}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {typeof attempt.scorePercent === 'number' ? `${attempt.scorePercent} %` : '—'}
            </div>
            <StatusBadge status={attempt.status} />
          </div>
        </div>

        {attempt.status === MEMBER_STATUS.PENDING_REVIEW && (
          <p style={{ margin: '0.85rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Skóre a výsledný stav se doplní, až budou ohodnocené všechny textové otázky.
          </p>
        )}

        {attempt.gradedBy && (
          <p style={{ margin: '0.6rem 0 0', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
            Naposledy hodnotil: {attempt.gradedBy.name} · {formatDateTime(attempt.gradedAt)}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {(quiz.questions || []).map((question, index) => {
          const keyEntry = answerKeyAnswers[question.id];
          const explanation = answerKeyExplanations[question.id];
          const memberAnswer = attempt.answers?.[question.id];
          const isText = question.type === 'text';
          const isCorrect = isText ? null : isAnswerCorrect(question, keyEntry, memberAnswer);
          const manualGrade = attempt.manualGrades?.[question.id];

          let borderColor = '#9E9E9E';
          if (isText) {
            if (manualGrade === 1) borderColor = '#2E7D32';
            else if (manualGrade === 0) borderColor = '#C62828';
          } else if (isCorrect === true) borderColor = '#2E7D32';
          else if (isCorrect === false) borderColor = '#C62828';

          return (
            <div key={question.id} className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: `4px solid ${borderColor}` }}>
              <p style={{ margin: '0 0 0.6rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {index + 1}. {question.text}
              </p>

              <p style={{ margin: '0 0 0.3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Odpověď člena: <strong style={{ color: 'var(--text-primary)' }}>{formatAnswerValue(question, memberAnswer)}</strong>
              </p>

              {!isText && (
                <p style={{ margin: '0 0 0.3rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Správná odpověď: <strong style={{ color: 'var(--text-primary)' }}>{formatAnswerValue(question, keyEntry?.correct)}</strong>
                </p>
              )}

              {explanation && (
                <p style={{ margin: '0 0 0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {explanation}
                </p>
              )}

              {!isText && (
                <span style={{
                  fontSize: '0.8rem', fontWeight: 700,
                  color: isCorrect === true ? '#2E7D32' : (isCorrect === false ? '#C62828' : 'var(--text-secondary)'),
                }}>
                  {isCorrect === true ? 'Správně' : (isCorrect === false ? 'Špatně' : 'Nelze automaticky vyhodnotit')}
                </span>
              )}

              {isText && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={gradingQuestionId === question.id}
                    onClick={() => handleGrade(question.id, 1)}
                    style={manualGrade === 1 ? {
                      color: '#2E7D32', background: '#E8F5E9', borderColor: '#A5D6A7', fontWeight: 700,
                    } : { fontSize: '0.85rem' }}
                  >
                    Uznat
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={gradingQuestionId === question.id}
                    onClick={() => handleGrade(question.id, 0)}
                    style={manualGrade === 0 ? {
                      color: '#C62828', background: '#FFEBEE', borderColor: '#FFCDD2', fontWeight: 700,
                    } : { fontSize: '0.85rem' }}
                  >
                    Neuznat
                  </button>
                  {manualGrade === undefined && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1565C0' }}>
                      Čeká na hodnocení
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
