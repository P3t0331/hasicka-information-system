import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, getDoc, query, where, runTransaction,
} from 'firebase/firestore';
import {
  MEMBER_STATUS, deriveMemberStatus, bestAttempt, isAssignedTo,
} from '../../shared/quizStatus.js';
import { computeScorePercent, isPassed } from '../../shared/quizScoring.js';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logAction } from '../utils/logger';

/**
 * Výsledky jednoho kvízu pro Administraci (úloha 14) — tabulka toho, kdo kvíz
 * splnil, nesplnil, čeká na vyhodnocení nebo ho ještě nevyplnil. Úlohy 15 a 16
 * na tomto hooku staví detail člena a statistiky po otázkách, proto vrací i
 * `answerKey` a syrové `attempts` — ať je nenačítají znovu.
 */

// Pro řádek, kde je aktuální stav odvozený z JINÉHO pokusu než "nejlepšího"
// (čekající na vyhodnocení nebo rozpracovaný pokus nemá číselné skóre, takže
// ho `bestAttempt` z shared/quizStatus.js záměrně přeskočí), potřebujeme
// vybrat pokus, ze kterého se v tabulce ukáže datum odevzdání a příznak
// pozdního odevzdání.
function displayAttempt(status, attempts) {
  if (status === MEMBER_STATUS.PASSED || status === MEMBER_STATUS.FAILED) {
    return bestAttempt(attempts);
  }
  if (status === MEMBER_STATUS.PENDING_REVIEW) {
    return attempts.find(a => a.status === 'pending_review') || null;
  }
  if (status === MEMBER_STATUS.IN_PROGRESS) {
    return attempts.find(a => a.status === 'in_progress') || null;
  }
  return null;
}

function surnameOf(member, fallbackName) {
  if (member?.lastName) return member.lastName;
  // Člen bez dokumentu v `users` (smazaný účet) — jméno pokusu je řetězec
  // "Jméno Příjmení" (viz formatUserName v useQuizAttempt.js), poslední slovo
  // je nejlepší dostupný odhad příjmení pro řazení.
  const parts = (fallbackName || '').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : '';
}

export default function useQuizResults(quizId) {
  const { currentUser, userData } = useAuth();
  const { addToast } = useToast();
  const actorName = userData ? `${userData.firstName} ${userData.lastName}` : '';

  const [quiz, setQuiz] = useState(null);
  const [quizLoaded, setQuizLoaded] = useState(false);
  const [answerKey, setAnswerKey] = useState(null);
  const [answerKeyLoaded, setAnswerKeyLoaded] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [trainings, setTrainings] = useState([]);
  const [trainingsLoaded, setTrainingsLoaded] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [attemptsLoaded, setAttemptsLoaded] = useState(false);

  // `dataQuizId` tracks which quizId the quiz-scoped state above (`quiz`,
  // `answerKey`, `attempts`, their `*Loaded` flags) currently belongs to.
  //
  // The check right below runs during render, not inside an effect: it's
  // React's documented "adjusting state when a prop changes" pattern
  // (react.dev, "You Might Not Need an Effect"). The instant `quizId`
  // differs from `dataQuizId` — a different quiz selected, or a selection
  // cleared — it resets every quiz-scoped piece of state synchronously and
  // records the new id, right there in the render that first sees the
  // change. React then discards that render without painting it and
  // immediately re-renders with the reset applied, so there is no frame —
  // not even one — where quiz B's title is shown over quiz A's rows and
  // summary while B's listeners are still in flight. An effect-keyed-on-
  // quizId reset (tried first) only clears the old values one render AFTER
  // the switch is already visible, which is exactly the gap that let stale
  // data leak through; it also trips this project's `react-hooks/set-state-
  // in-effect` lint rule, which flags any direct `setState` call in an
  // effect body, guard or no guard.
  //
  // `members`/`trainings` are deliberately NOT reset here — those two
  // collections aren't scoped to a quiz at all, so a value left over from
  // the previous quiz is still accurate for the new one; resetting them
  // would only add pointless loading flicker.
  const [dataQuizId, setDataQuizId] = useState(quizId);
  if (quizId !== dataQuizId) {
    setDataQuizId(quizId);
    setQuiz(null);
    setQuizLoaded(false);
    setAnswerKey(null);
    setAnswerKeyLoaded(false);
    setAttempts([]);
    setAttemptsLoaded(false);
  }

  useEffect(() => {
    if (!quizId) return undefined;
    const unsubscribe = onSnapshot(doc(db, 'quizzes', quizId), (snap) => {
      setQuiz(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setQuizLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

  // `cancelled` ignores a `getDoc()` that resolves after `quizId` has
  // already moved on to another quiz (or back to none): the render-phase
  // reset above will already have cleared `answerKey` by then, and this
  // stale response must not write a different quiz's answer key back into it.
  useEffect(() => {
    if (!quizId) return undefined;
    let cancelled = false;
    getDoc(doc(db, 'quizAnswerKeys', quizId)).then((snap) => {
      if (cancelled) return;
      setAnswerKey(snap.exists() ? snap.data() : null);
      setAnswerKeyLoaded(true);
    }).catch((err) => {
      console.error('Error loading quiz answer key:', err);
      if (!cancelled) { setAnswerKey(null); setAnswerKeyLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return undefined;
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembers(snapshot.docs.map(d => ({ uid: d.id, ...d.data() })));
      setMembersLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return undefined;
    const unsubscribe = onSnapshot(collection(db, 'trainings'), (snapshot) => {
      setTrainings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setTrainingsLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return undefined;
    const attemptsQuery = query(collection(db, 'quizAttempts'), where('quizId', '==', quizId));
    const unsubscribe = onSnapshot(attemptsQuery, (snapshot) => {
      setAttempts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setAttemptsLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

  const training = useMemo(() => {
    if (!quiz || quiz.assignment?.mode !== 'training' || !quiz.trainingId) return null;
    return trainings.find(t => t.id === quiz.trainingId) || null;
  }, [quiz, trainings]);

  const rows = useMemo(() => {
    if (!quiz) return [];

    const attemptsByUid = new Map();
    attempts.forEach((a) => {
      if (!attemptsByUid.has(a.uid)) attemptsByUid.set(a.uid, []);
      attemptsByUid.get(a.uid).push(a);
    });

    const memberByUid = new Map(members.map(m => [m.uid, m]));

    // Kdo patří do tabulky: aktuálně přiřazení členové (isAssignedTo) plus
    // kdokoli s alespoň jedním pokusem — i když už kvíz nemá přiřazený
    // (odešel z role/výcviku) nebo byl mezitím deaktivován. Záznam o tom, že
    // se povinné školení stalo, nesmí zmizet, jen protože člen odešel z
    // jednotky.
    const uids = new Set();
    members.forEach((m) => {
      if (isAssignedTo(quiz, m, training)) uids.add(m.uid);
    });
    attemptsByUid.forEach((_, uid) => uids.add(uid));

    const surnameByUid = new Map();
    const list = Array.from(uids).map((uid) => {
      const memberAttempts = attemptsByUid.get(uid) || [];
      const member = memberByUid.get(uid);
      const status = deriveMemberStatus(memberAttempts);
      const disp = displayAttempt(status, memberAttempts);
      const isTerminal = status === MEMBER_STATUS.PASSED || status === MEMBER_STATUS.FAILED;
      const name = member
        ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Neznámý člen'
        : (memberAttempts[0]?.userName || 'Neznámý člen');

      surnameByUid.set(uid, surnameOf(member, memberAttempts[0]?.userName || name));

      return {
        uid,
        name,
        status,
        scorePercent: isTerminal && disp ? disp.scorePercent : null,
        submittedAt: disp ? disp.submittedAt : null,
        attemptsCount: memberAttempts.length,
        isLate: disp ? Boolean(disp.isLate) : false,
        attempts: memberAttempts,
      };
    });

    // Nesplnění a nevyplnění nahoru, splnění dolů — admin se má nejdřív dívat
    // na to, co ještě není hotové. Sekundárně abecedně podle příjmení (česká
    // kolace).
    list.sort((a, b) => {
      const aPassed = a.status === MEMBER_STATUS.PASSED;
      const bPassed = b.status === MEMBER_STATUS.PASSED;
      if (aPassed !== bPassed) return aPassed ? 1 : -1;
      return surnameByUid.get(a.uid).localeCompare(surnameByUid.get(b.uid), 'cs');
    });

    return list;
  }, [quiz, members, attempts, training]);

  const summary = useMemo(() => {
    const s = {
      assigned: rows.length, passed: 0, failed: 0, pending: 0, notStarted: 0,
    };
    rows.forEach((row) => {
      if (row.status === MEMBER_STATUS.PASSED) s.passed += 1;
      else if (row.status === MEMBER_STATUS.FAILED) s.failed += 1;
      else if (row.status === MEMBER_STATUS.PENDING_REVIEW) s.pending += 1;
      // NOT_STARTED i IN_PROGRESS se pro admina obojí počítá jako "ještě
      // nevyplnil" — kvíz do konce nedotáhl, ať už ho nezačal, nebo rozdělal.
      else s.notStarted += 1;
    });
    return s;
  }, [rows]);

  // Ruční hodnocení jedné textové otázky pokusu (úloha 15). `attempt` v
  // argumentu jen určuje, KTERÝ dokument se má upravit (`attempt.id`) — data,
  // ze kterých se počítá nový `manualGrades`/`scorePercent`, se vždy čtou
  // čerstvě uvnitř transakce, ne z tohoto (může být zastaralého) objektu.
  // Bez toho by dva velitelé, kteří během pár vteřin ohodnotí dvě různé
  // otázky téhož pokusu, mohli přepsat mapu `manualGrades` jeden druhému —
  // oba by vycházeli ze stejné (starší) mapy a druhý zápis by tak smazal
  // hodnocení prvního. Transakce to řeší: Firestore ji při konfliktu s
  // konkurenčním zápisem sama zopakuje nad čerstvými daty, takže druhý zápis
  // vždy staví na výsledku prvního, ne ho přepisuje.
  //
  // `questionCount`/`autoCorrectCount` se berou z dokumentu pokusu (zapsal je
  // server při odevzdání) — tady se nikdy nepřepočítávají z `quiz.questions`
  // ani z `attempt.answers`, aby chyba na klientovi nemohla tiše přepsat
  // uložený výsledek.
  async function gradeAnswer(attempt, questionId, points) {
    if (!quiz || !attempt?.id) return;

    const manualQuestionIds = (quiz.questions || [])
      .filter(q => q.type === 'text')
      .map(q => q.id);

    const attemptRef = doc(db, 'quizAttempts', attempt.id);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(attemptRef);
        if (!snap.exists()) return;
        const current = snap.data();

        const manualGrades = { ...(current.manualGrades || {}), [questionId]: points };
        const allGraded = manualQuestionIds.every(id => manualGrades[id] !== undefined);

        const scorePercent = computeScorePercent({
          questionCount: current.questionCount,
          autoCorrectCount: current.autoCorrectCount,
          manualGrades,
        });
        const passed = allGraded ? isPassed(scorePercent, quiz.passThreshold) : null;

        transaction.update(attemptRef, {
          manualGrades,
          scorePercent: allGraded ? scorePercent : null,
          passed,
          // Dokud chybí hodnocení byť jedné textové otázky, stav zůstává
          // pending_review a scorePercent null — částečné skóre by vypadalo
          // jako finální a mohlo by členovi ukázat "nesplnil" dřív, než
          // velitel dohodnotí zbytek.
          status: allGraded ? (passed ? 'passed' : 'failed') : 'pending_review',
          gradedBy: { uid: currentUser.uid, name: actorName },
          gradedAt: new Date().toISOString(),
        });
      });

      logAction(db, currentUser.uid, actorName, 'GRADED_QUIZ_ANSWER', 'admin',
        `Ohodnotil otevřenou otázku v kvízu „${quiz.title}“ pro ${attempt.userName || attempt.uid} (${points ? 'uznáno' : 'neuznáno'})`);
    } catch (err) {
      console.error('Error grading quiz answer:', err);
      addToast('error', 'Chyba při ukládání hodnocení.');
    }
  }

  return {
    quiz,
    answerKey,
    rows,
    attempts,
    loading: !(quizLoaded && answerKeyLoaded && membersLoaded && trainingsLoaded && attemptsLoaded),
    summary,
    gradeAnswer,
  };
}
