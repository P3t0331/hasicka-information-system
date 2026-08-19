import React from 'react';
import { pragueDateString } from '../../../shared/quizStatus.js';

function pluralize(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}. ${y}`;
}

// `canStart` (z useMyQuizzes) může být false ze čtyř různých důvodů, které se
// slovně nesmí zaměnit — proto text vybírá volající stránka (přes
// `blockReason`), ne tato prezentační komponenta. Poslední `exhausted` je
// zároveň bezpečný výchozí text, kdyby `blockReason` z nějakého důvodu chyběl.
const BLOCK_MESSAGES = {
  passed: 'Tento kvíz jste již úspěšně splnili.',
  pending_review: 'Váš pokus byl odevzdán a čeká na vyhodnocení.',
  closed: 'Kvíz byl uzavřen a nelze ho již vyplnit.',
  exhausted: 'Vyčerpali jste všechny pokusy.',
};

/**
 * Karta před zahájením kvízu — přehled parametrů a tlačítko Zahájit kvíz.
 * Čistě prezentační: data, zápis i důvod nedostupnosti (`blockReason`) vlastní
 * volající stránka; komponenta jen vybere odpovídající text.
 *
 * `canStart` je přebrané z `useMyQuizzes()` (rozhoduje `myStatus !== 'passed'`,
 * `myStatus !== 'pending_review'`, `quiz.status !== 'closed'` i zbývající
 * pokusy), aby se stejné pravidlo nemuselo v komponentě znovu odvozovat.
 */
export default function QuizIntro({ quiz, attemptsUsed, canStart, blockReason, onStart, starting }) {
  const questionCount = quiz.questions?.length || 0;
  const maxAttempts = quiz.maxAttempts || 0;
  const remainingAttempts = maxAttempts === 0 ? null : Math.max(maxAttempts - attemptsUsed, 0);
  const isPastDeadline = Boolean(quiz.deadline) && pragueDateString(new Date().toISOString()) > quiz.deadline;

  return (
    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', maxWidth: '560px' }}>
      <div>
        <h2 style={{ margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>{quiz.title}</h2>
        {quiz.description && (
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{quiz.description}</p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem', fontSize: '0.9rem' }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Počet otázek</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {questionCount} {pluralize(questionCount, 'otázka', 'otázky', 'otázek')}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Hranice úspěšnosti</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{quiz.passThreshold} %</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Zbývající pokusy</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {remainingAttempts === null
              ? 'Neomezeně'
              : `${remainingAttempts} ${pluralize(remainingAttempts, 'pokus', 'pokusy', 'pokusů')}`}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Časový limit</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {quiz.timeLimitMinutes
              ? `${quiz.timeLimitMinutes} ${pluralize(quiz.timeLimitMinutes, 'minuta', 'minuty', 'minut')}`
              : 'Bez limitu'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Termín</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(quiz.deadline)}</div>
        </div>
      </div>

      {isPastDeadline && (
        <div style={{
          background: '#FFF3E0', border: '1px solid #FFCC80', color: '#E65100',
          borderRadius: '8px', padding: '0.65rem 0.85rem', fontSize: '0.88rem', fontWeight: 600,
        }}
        >
          Termín už uplynul. Odevzdání bude označeno jako opožděné.
        </div>
      )}

      {canStart ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={onStart}
          disabled={starting}
          style={{ alignSelf: 'flex-start' }}
        >
          {starting ? 'Zahajuji…' : 'Zahájit kvíz'}
        </button>
      ) : (
        <p style={{ margin: 0, color: '#C62828', fontWeight: 600 }}>
          {BLOCK_MESSAGES[blockReason] || BLOCK_MESSAGES.exhausted}
        </p>
      )}
    </div>
  );
}
