import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, getDoc, query, where,
} from 'firebase/firestore';
import {
  MEMBER_STATUS, deriveMemberStatus, bestAttempt, isAssignedTo,
} from '../../shared/quizStatus.js';

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

  // Pozn.: pokud `quizId` chybí (detail výsledků není otevřený), efekty se
  // vůbec nepřihlašují k odběru a stav z předchozí volby jednoduše zůstane
  // ležet nepoužitý — nic ho nezobrazuje, dokud `quizId` znovu nepřijde. Mezi
  // dvěma různými kvízy uživatel vždy projde zpět na seznam (`selectedQuizId`
  // se vynuluje), takže se sem `quizId` nikdy nepřepne přímo z jednoho id na
  // jiné bez té mezizastávky na `null`.
  useEffect(() => {
    if (!quizId) return undefined;
    const unsubscribe = onSnapshot(doc(db, 'quizzes', quizId), (snap) => {
      setQuiz(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setQuizLoaded(true);
    });
    return unsubscribe;
  }, [quizId]);

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

  return {
    quiz,
    answerKey,
    rows,
    attempts,
    loading: !(quizLoaded && answerKeyLoaded && membersLoaded && trainingsLoaded && attemptsLoaded),
    summary,
  };
}
