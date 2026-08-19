import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, query, where, setDoc,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

/**
 * Zahájení a vyplňování jednoho pokusu na konkrétní kvíz (`/skoleni/kviz/:quizId`).
 *
 * Úloha 11 implementuje čtení kvízu a pokusu a `startAttempt()`. Vyplňování
 * otázek (`setAnswer`) a odevzdání (`submitAttempt`) doplní úlohy 12 a 13 —
 * záměrně tu nejsou ani jako prázdné stuby, aby nevznikl dojem hotové funkce.
 */

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOrder(quiz) {
  const ids = quiz.questions.map(q => q.id);
  const questionIds = quiz.shuffleQuestions ? shuffled(ids) : ids;
  const optionOrder = {};
  for (const question of quiz.questions) {
    const optionIds = (question.options || []).map(o => o.id);
    optionOrder[question.id] = quiz.shuffleOptions ? shuffled(optionIds) : optionIds;
  }
  return { questionIds, optionOrder };
}

// `userName` se ukládá do dokumentu pokusu a odtud i do oficiálního protokolu,
// který jednotka ukazuje při kontrole — neúplný profil proto nesmí vyprodukovat
// doslovné "undefined undefined", ale rozumný náhradní text.
function formatUserName(userData) {
  const first = (userData?.firstName || '').trim();
  const last = (userData?.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ');
  return full || 'Neznámý člen';
}

export default function useQuizAttempt(quizId) {
  const { currentUser, userData } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [quizLoaded, setQuizLoaded] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!quizId) return undefined;
    const unsubscribe = onSnapshot(doc(db, 'quizzes', quizId), (snap) => {
      setQuiz(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setQuizLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

  useEffect(() => {
    // Stránka je za PrivateRoute, takže currentUser bude v praxi vždy k dispozici;
    // guard je jen obranný, ať where() nikdy nedostane undefined.
    if (!quizId || !currentUser?.uid) return undefined;
    const attemptsQuery = query(
      collection(db, 'quizAttempts'),
      where('quizId', '==', quizId),
      where('uid', '==', currentUser.uid),
    );
    const unsubscribe = onSnapshot(attemptsQuery, (snapshot) => {
      setAttempts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setAttemptsLoaded(true);
    });
    return unsubscribe;
  }, [quizId, currentUser?.uid]);

  // Nejvýš jeden rozpracovaný pokus může v danou chvíli existovat — nový nejde
  // založit, dokud se předchozí neodevzdá (submitAttempt, úloha 13).
  const attempt = useMemo(
    () => attempts.find(a => a.status === 'in_progress') || null,
    [attempts],
  );

  const startAttempt = useCallback(async () => {
    if (!quiz || !currentUser?.uid || !userData || starting || attempt) return;
    setStarting(true);
    setError(null);
    try {
      // attemptNumber vychází z pokusů, které tento hook právě vidí (vlastní
      // onSnapshot nad quizAttempts filtrovaný na quizId+uid). Pokud je tento
      // pohled zastaralý — např. jiná záložka mezitím pokus se stejným číslem
      // už založila nebo odevzdala — dokument se stejným deterministickým id
      // buď už existuje s jiným stavem než 'in_progress' (update pravidlo
      // vyžaduje resource.data.status == 'in_progress', takže zápis spadne
      // jako update na hotový pokus), nebo existuje jako rozpracovaný a tento
      // zápis by měnil pole mimo ['answers', 'lastSavedAt'] (nové 'order',
      // 'startedAt' apod.), což update pravidlo také odmítne. V obou
      // případech Firestore zápis zamítne permission-denied a žádný pokus
      // se tiše nepřepíše ani nezdvojí.
      const attemptNumber = attempts.length + 1;
      const attemptId = `${quizId}_${currentUser.uid}_${attemptNumber}`;
      const now = new Date().toISOString();
      await setDoc(doc(db, 'quizAttempts', attemptId), {
        quizId,
        uid: currentUser.uid,
        userName: formatUserName(userData),
        attemptNumber,
        status: 'in_progress',
        order: buildOrder(quiz),
        answers: {},
        startedAt: now,
        lastSavedAt: now,
        submittedAt: null,
        isLate: false,
        questionCount: quiz.questions.length,
        autoCorrectCount: 0,
        manualGrades: {},
        scorePercent: null,
        passed: null,
        gradedBy: null,
        gradedAt: null,
      });
    } catch (err) {
      console.error('Error starting quiz attempt:', err);
      setError('Kvíz se nepodařilo zahájit. Zkuste to prosím znovu.');
    } finally {
      setStarting(false);
    }
  }, [quiz, quizId, currentUser?.uid, userData, attempts, attempt, starting]);

  return {
    quiz,
    attempt,
    loading: !(quizLoaded && attemptsLoaded),
    error,
    starting,
    startAttempt,
  };
}
