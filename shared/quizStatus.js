/**
 * Sdílená logika stavů kvízu — přiřazení, odvození stavu člena, termíny a limity.
 * Používá ji klient i serverové funkce v api/.
 */

export const MEMBER_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PENDING_REVIEW: 'pending_review',
  PASSED: 'passed',
  FAILED: 'failed',
};

export function deriveMemberStatus(attempts = []) {
  if (!attempts.length) return MEMBER_STATUS.NOT_STARTED;
  if (attempts.some(a => a.status === 'passed')) return MEMBER_STATUS.PASSED;
  if (attempts.some(a => a.status === 'pending_review')) return MEMBER_STATUS.PENDING_REVIEW;
  if (attempts.some(a => a.status === 'in_progress')) return MEMBER_STATUS.IN_PROGRESS;
  return MEMBER_STATUS.FAILED;
}

export function bestAttempt(attempts = []) {
  const submitted = attempts.filter(a => a.status !== 'in_progress' && typeof a.scorePercent === 'number');
  if (!submitted.length) return null;
  return submitted.reduce((best, a) => (a.scorePercent > best.scorePercent ? a : best));
}

function memberRoles(member) {
  return member?.roles || (member?.role ? [member.role] : []);
}

export function isAssignedTo(quiz, member, training = null) {
  if (!quiz || quiz.status !== 'published' || !member) return false;
  if (member.approved !== true || member.disabled === true) return false;

  const mode = quiz.assignment?.mode || 'all';
  if (mode === 'all') return true;
  if (mode === 'roles') {
    const roles = memberRoles(member);
    return (quiz.assignment?.roles || []).some(role => roles.includes(role));
  }
  if (mode === 'training') {
    return Boolean(training?.participants?.some(p => p.uid === member.uid));
  }
  return false;
}

export function pragueDateString(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function isLateSubmission(deadline, submittedAt) {
  if (!deadline || !submittedAt) return false;
  return pragueDateString(submittedAt) > deadline;
}

export function isTimeExpired(startedAt, timeLimitMinutes, now) {
  if (!timeLimitMinutes || !startedAt) return false;
  return new Date(now).getTime() - new Date(startedAt).getTime() > timeLimitMinutes * 60000;
}

export function remainingSeconds(startedAt, timeLimitMinutes, now) {
  if (!timeLimitMinutes || !startedAt) return 0;
  const elapsed = new Date(now).getTime() - new Date(startedAt).getTime();
  const left = timeLimitMinutes * 60000 - elapsed;
  return left > 0 ? Math.floor(left / 1000) : 0;
}
