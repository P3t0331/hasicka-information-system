/**
 * Sdílená logika vyhodnocování kvízů.
 * Používá ji klient i serverová funkce api/quiz-submit.js — neduplikovat.
 */

function toSelection(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return [...value].sort();
  return [value];
}

export function isAnswerCorrect(question, keyEntry, answer) {
  if (!keyEntry || keyEntry.autoGraded === false || question.type === 'text') return null;

  if (question.type === 'boolean') {
    return answer === keyEntry.correct;
  }

  const given = toSelection(answer);
  const correct = toSelection(keyEntry.correct);
  if (given.length !== correct.length) return false;
  return given.every((id, index) => id === correct[index]);
}

export function gradeAttempt(quiz, answerKey, answers = {}) {
  const questions = quiz?.questions || [];
  const key = answerKey?.answers || {};
  const perQuestion = {};
  const manualQuestionIds = [];
  let autoCorrectCount = 0;

  for (const question of questions) {
    const result = isAnswerCorrect(question, key[question.id], answers[question.id]);
    perQuestion[question.id] = result;
    if (result === null) manualQuestionIds.push(question.id);
    else if (result === true) autoCorrectCount += 1;
  }

  return {
    questionCount: questions.length,
    autoCorrectCount,
    manualQuestionIds,
    perQuestion,
  };
}

export function computeScorePercent({ questionCount, autoCorrectCount, manualGrades = {} }) {
  if (!questionCount) return 0;
  const manualPoints = Object.values(manualGrades).reduce((sum, value) => sum + (value ? 1 : 0), 0);
  return Math.round(((autoCorrectCount + manualPoints) / questionCount) * 100);
}

export function isPassed(scorePercent, passThreshold) {
  return scorePercent >= passThreshold;
}
