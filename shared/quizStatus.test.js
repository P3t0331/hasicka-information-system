import { describe, it, expect } from 'vitest';
import {
  MEMBER_STATUS,
  deriveMemberStatus,
  bestAttempt,
  isAssignedTo,
  isLateSubmission,
  isTimeExpired,
  remainingSeconds,
  pragueDateString,
} from './quizStatus.js';

describe('deriveMemberStatus', () => {
  it('bez pokusů je nezahájeno', () => {
    expect(deriveMemberStatus([])).toBe(MEMBER_STATUS.NOT_STARTED);
  });

  it('splněný pokus přebíjí ostatní', () => {
    const attempts = [{ status: 'failed' }, { status: 'passed' }, { status: 'in_progress' }];
    expect(deriveMemberStatus(attempts)).toBe(MEMBER_STATUS.PASSED);
  });

  it('čekání na vyhodnocení má přednost před rozpracovaným', () => {
    expect(deriveMemberStatus([{ status: 'in_progress' }, { status: 'pending_review' }]))
      .toBe(MEMBER_STATUS.PENDING_REVIEW);
  });

  it('rozpracovaný pokus', () => {
    expect(deriveMemberStatus([{ status: 'in_progress' }])).toBe(MEMBER_STATUS.IN_PROGRESS);
  });

  it('samé neúspěšné pokusy znamenají nesplnil', () => {
    expect(deriveMemberStatus([{ status: 'failed' }, { status: 'failed' }])).toBe(MEMBER_STATUS.FAILED);
  });
});

describe('bestAttempt', () => {
  it('vrací pokus s nejvyšším skóre', () => {
    const attempts = [
      { status: 'failed', scorePercent: 40 },
      { status: 'passed', scorePercent: 90 },
      { status: 'in_progress', scorePercent: null },
    ];
    expect(bestAttempt(attempts).scorePercent).toBe(90);
  });

  it('ignoruje rozpracované pokusy', () => {
    expect(bestAttempt([{ status: 'in_progress', scorePercent: null }])).toBe(null);
  });

  it('bez pokusů vrací null', () => {
    expect(bestAttempt([])).toBe(null);
  });
});

describe('isAssignedTo', () => {
  const member = { uid: 'u1', approved: true, disabled: false, roles: ['Hasič', 'Strojník'] };

  it('režim all platí pro aktivního člena', () => {
    const quiz = { status: 'published', assignment: { mode: 'all' } };
    expect(isAssignedTo(quiz, member)).toBe(true);
  });

  it('neschválený ani deaktivovaný člen kvíz nedostane', () => {
    const quiz = { status: 'published', assignment: { mode: 'all' } };
    expect(isAssignedTo(quiz, { ...member, approved: false })).toBe(false);
    expect(isAssignedTo(quiz, { ...member, disabled: true })).toBe(false);
  });

  it('koncept se nikomu nezobrazuje', () => {
    expect(isAssignedTo({ status: 'draft', assignment: { mode: 'all' } }, member)).toBe(false);
  });

  it('režim roles porovnává role', () => {
    const quiz = { status: 'published', assignment: { mode: 'roles', roles: ['Strojník'] } };
    expect(isAssignedTo(quiz, member)).toBe(true);
    expect(isAssignedTo(quiz, { ...member, roles: ['Hasič'] })).toBe(false);
  });

  it('zvládne starý tvar s jedinou rolí v poli role', () => {
    const quiz = { status: 'published', assignment: { mode: 'roles', roles: ['Hasič'] } };
    expect(isAssignedTo(quiz, { uid: 'u2', approved: true, role: 'Hasič' })).toBe(true);
  });

  it('režim training bere účastníky školení', () => {
    const quiz = { status: 'published', assignment: { mode: 'training' }, trainingId: 't1' };
    const training = { id: 't1', participants: [{ uid: 'u1' }] };
    expect(isAssignedTo(quiz, member, training)).toBe(true);
    expect(isAssignedTo(quiz, { ...member, uid: 'u9' }, training)).toBe(false);
    expect(isAssignedTo(quiz, member, null)).toBe(false);
  });
});

describe('isLateSubmission', () => {
  it('odeslání v den termínu není opožděné', () => {
    expect(isLateSubmission('2026-09-30', '2026-09-30T21:30:00.000Z')).toBe(false);
  });

  it('odeslání následující den je opožděné', () => {
    expect(isLateSubmission('2026-09-30', '2026-10-01T08:00:00.000Z')).toBe(true);
  });

  it('bez termínu nebo bez odeslání je false', () => {
    expect(isLateSubmission(null, '2026-10-01T08:00:00.000Z')).toBe(false);
    expect(isLateSubmission('2026-09-30', null)).toBe(false);
  });
});

describe('isTimeExpired', () => {
  const start = '2026-09-01T10:00:00.000Z';

  it('bez limitu nikdy nevyprší', () => {
    expect(isTimeExpired(start, null, '2027-01-01T00:00:00.000Z')).toBe(false);
  });

  it('uvnitř limitu neplatí', () => {
    expect(isTimeExpired(start, 15, '2026-09-01T10:14:00.000Z')).toBe(false);
  });

  it('po limitu platí', () => {
    expect(isTimeExpired(start, 15, '2026-09-01T10:15:01.000Z')).toBe(true);
  });
});

describe('remainingSeconds', () => {
  const start = '2026-09-01T10:00:00.000Z';

  it('spočítá zbývající čas', () => {
    expect(remainingSeconds(start, 15, '2026-09-01T10:05:00.000Z')).toBe(600);
  });

  it('po vypršení vrací nulu', () => {
    expect(remainingSeconds(start, 15, '2026-09-01T11:00:00.000Z')).toBe(0);
  });

  it('bez limitu vrací nulu', () => {
    expect(remainingSeconds(start, null, '2026-09-01T10:05:00.000Z')).toBe(0);
  });
});

describe('pragueDateString', () => {
  it('převádí UTC půlnoc na pražský den', () => {
    expect(pragueDateString('2026-09-30T22:30:00.000Z')).toBe('2026-10-01');
  });
});
