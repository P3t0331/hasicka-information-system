import { describe, it, expect } from 'vitest';
import { isAnswerCorrect, gradeAttempt, computeScorePercent, isPassed } from './quizScoring.js';

const single = { id: 'q1', type: 'single', options: [{ id: 'a' }, { id: 'b' }] };
const multi = { id: 'q2', type: 'multi', options: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
const bool = { id: 'q3', type: 'boolean', options: [] };
const text = { id: 'q4', type: 'text', options: [] };

describe('isAnswerCorrect', () => {
  it('uzná jednu správnou odpověď', () => {
    expect(isAnswerCorrect(single, { correct: ['a'], autoGraded: true }, ['a'])).toBe(true);
  });

  it('odmítne jinou volbu', () => {
    expect(isAnswerCorrect(single, { correct: ['a'], autoGraded: true }, ['b'])).toBe(false);
  });

  it('přijímá i odpověď uloženou jako řetězec', () => {
    expect(isAnswerCorrect(single, { correct: ['a'], autoGraded: true }, 'a')).toBe(true);
  });

  it('uzná vícenásobnou volbu při přesné shodě bez ohledu na pořadí', () => {
    expect(isAnswerCorrect(multi, { correct: ['a', 'c'], autoGraded: true }, ['c', 'a'])).toBe(true);
  });

  it('nedává bod za částečnou shodu', () => {
    expect(isAnswerCorrect(multi, { correct: ['a', 'c'], autoGraded: true }, ['a'])).toBe(false);
  });

  it('nedává bod za nadbytečnou volbu navíc', () => {
    expect(isAnswerCorrect(multi, { correct: ['a', 'c'], autoGraded: true }, ['a', 'b', 'c'])).toBe(false);
  });

  it('vyhodnotí ano/ne', () => {
    expect(isAnswerCorrect(bool, { correct: true, autoGraded: true }, true)).toBe(true);
    expect(isAnswerCorrect(bool, { correct: true, autoGraded: true }, false)).toBe(false);
  });

  it('vrací null u textové otázky', () => {
    expect(isAnswerCorrect(text, { autoGraded: false }, 'cokoliv')).toBe(null);
  });

  it('nezodpovězená otázka je špatně', () => {
    expect(isAnswerCorrect(single, { correct: ['a'], autoGraded: true }, undefined)).toBe(false);
    expect(isAnswerCorrect(multi, { correct: ['a'], autoGraded: true }, [])).toBe(false);
  });
});

describe('gradeAttempt', () => {
  const quiz = { questions: [single, multi, bool, text] };
  const key = {
    answers: {
      q1: { correct: ['a'], autoGraded: true },
      q2: { correct: ['a', 'c'], autoGraded: true },
      q3: { correct: true, autoGraded: true },
      q4: { autoGraded: false },
    },
  };

  it('spočítá automatické otázky a vyjmenuje ty k ručnímu hodnocení', () => {
    const result = gradeAttempt(quiz, key, { q1: ['a'], q2: ['a'], q3: true, q4: 'odpověď' });
    expect(result.questionCount).toBe(4);
    expect(result.autoCorrectCount).toBe(2);
    expect(result.manualQuestionIds).toEqual(['q4']);
    expect(result.perQuestion).toEqual({ q1: true, q2: false, q3: true, q4: null });
  });

  it('zvládne prázdné odpovědi', () => {
    const result = gradeAttempt(quiz, key, {});
    expect(result.autoCorrectCount).toBe(0);
    expect(result.questionCount).toBe(4);
  });
});

describe('computeScorePercent', () => {
  it('započítá ručně uznané body', () => {
    expect(computeScorePercent({ questionCount: 4, autoCorrectCount: 2, manualGrades: { q4: 1 } })).toBe(75);
  });

  it('neuznaná textovka bod nepřidá', () => {
    expect(computeScorePercent({ questionCount: 4, autoCorrectCount: 2, manualGrades: { q4: 0 } })).toBe(50);
  });

  it('zaokrouhluje na celé procento', () => {
    expect(computeScorePercent({ questionCount: 3, autoCorrectCount: 2, manualGrades: {} })).toBe(67);
  });

  it('nedělí nulou', () => {
    expect(computeScorePercent({ questionCount: 0, autoCorrectCount: 0, manualGrades: {} })).toBe(0);
  });
});

describe('isPassed', () => {
  it('hranice je včetně', () => {
    expect(isPassed(80, 80)).toBe(true);
    expect(isPassed(79, 80)).toBe(false);
  });
});
