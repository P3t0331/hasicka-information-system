import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { logAction } from '../utils/logger';
import { getEffectiveRoles } from '../utils/roles';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const MANAGE_ROLES = ['Admin', 'VJ', 'Zástupce VJ', 'Zastupce VJ'];

export const EMPTY_QUIZ = {
  title: '',
  description: '',
  status: 'draft',
  trainingId: null,
  assignment: { mode: 'all', roles: [] },
  deadline: '',
  passThreshold: 80,
  maxAttempts: 3,
  timeLimitMinutes: null,
  shuffleQuestions: false,
  shuffleOptions: false,
  showCorrectAnswers: true,
  notifyOnPublish: true,
  questions: [],
};

// Jediné místo, odkud modul kvízů posílá push notifikace — na úrovni modulu
// (ne uvnitř hooku), aby ji šlo importovat i z useQuizResults.js (hodnocení
// textových otázek) bez nutnosti instanciovat celý useQuizzes.
export async function sendQuizNotification({ title, body, url = '/skoleni', tag, targetRoles, targetUserIds }) {
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, body, url, tag,
        ...(targetRoles ? { targetRoles } : {}),
        ...(targetUserIds ? { targetUserIds } : {}),
      }),
    });
  } catch (err) {
    console.error('Chyba při odesílání notifikace:', err);
  }
}

export function validateForPublish(quiz, answerKey) {
  const errors = [];
  if (!quiz.title?.trim()) errors.push('Kvíz musí mít název.');
  if (!quiz.deadline) errors.push('Nastavte termín odevzdání.');
  if (!quiz.questions?.length) errors.push('Kvíz musí mít alespoň jednu otázku.');

  (quiz.questions || []).forEach((question, index) => {
    const position = index + 1;
    if (!question.text?.trim()) errors.push(`Otázka ${position} nemá znění.`);
    if (question.type === 'single' || question.type === 'multi') {
      if ((question.options || []).length < 2) errors.push(`Otázka ${position} musí mít alespoň dvě volby.`);
      if ((question.options || []).some(o => !o.text?.trim())) errors.push(`Otázka ${position} má prázdnou volbu.`);
      const correct = answerKey?.answers?.[question.id]?.correct || [];
      if (!correct.length) errors.push(`Otázka ${position} nemá označenou správnou odpověď.`);
    }
    if (question.type === 'boolean' && typeof answerKey?.answers?.[question.id]?.correct !== 'boolean') {
      errors.push(`Otázka ${position} nemá označenou správnou odpověď.`);
    }
  });

  if (quiz.assignment?.mode === 'roles' && !(quiz.assignment.roles || []).length) {
    errors.push('Vyberte alespoň jednu roli.');
  }
  if (quiz.assignment?.mode === 'training' && !quiz.trainingId) {
    errors.push('Režim podle školení vyžaduje vybrané školení.');
  }
  return errors;
}

export default function useQuizzes() {
  const { currentUser, userData } = useAuth();
  const { addToast } = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const userRoles = getEffectiveRoles(userData ? (userData.roles || [userData.role || 'Hasič']) : []);
  const canManage = userRoles.some(r => MANAGE_ROLES.includes(r));
  const actorName = userData ? `${userData.firstName} ${userData.lastName}` : '';

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'quizzes'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setQuizzes(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function createQuiz() {
    try {
      const ref = await addDoc(collection(db, 'quizzes'), {
        ...EMPTY_QUIZ,
        createdBy: { uid: currentUser.uid, name: actorName },
        createdAt: new Date().toISOString(),
        publishedAt: null,
        closedAt: null,
      });
      await setDoc(doc(db, 'quizAnswerKeys', ref.id), { answers: {}, explanations: {} });
      return ref.id;
    } catch (err) {
      console.error('Error creating quiz:', err);
      addToast('error', 'Chyba při vytváření kvízu.');
      return null;
    }
  }

  async function updateQuiz(quizId, patch) {
    try {
      await updateDoc(doc(db, 'quizzes', quizId), patch);
    } catch (err) {
      console.error('Error updating quiz:', err);
      addToast('error', 'Chyba při ukládání kvízu.');
    }
  }

  async function saveAnswerKey(quizId, answerKey) {
    try {
      await setDoc(doc(db, 'quizAnswerKeys', quizId), answerKey);
    } catch (err) {
      console.error('Error saving answer key:', err);
      addToast('error', 'Chyba při ukládání odpovědí.');
    }
  }

  async function loadAnswerKey(quizId) {
    const snap = await getDoc(doc(db, 'quizAnswerKeys', quizId));
    return snap.exists() ? snap.data() : null;
  }

  async function publishQuiz(quiz, answerKey) {
    const errors = validateForPublish(quiz, answerKey);
    if (errors.length) {
      addToast('error', errors[0]);
      return false;
    }
    try {
      await updateDoc(doc(db, 'quizzes', quiz.id), {
        status: 'published',
        publishedAt: new Date().toISOString(),
      });
      logAction(db, currentUser.uid, actorName, 'PUBLISHED_QUIZ', 'admin',
        `Zveřejnil kvíz „${quiz.title}“ (termín ${quiz.deadline})`);
      if (quiz.notifyOnPublish) {
        sendQuizNotification({
          title: 'Nový povinný kvíz',
          body: `${quiz.title} — termín do ${quiz.deadline}`,
          tag: `quiz-${quiz.id}`,
          ...(quiz.assignment?.mode === 'roles' ? { targetRoles: quiz.assignment.roles } : {}),
        });
      }
      addToast('success', 'Kvíz zveřejněn.');
      return true;
    } catch (err) {
      console.error('Error publishing quiz:', err);
      addToast('error', 'Chyba při zveřejňování kvízu.');
      return false;
    }
  }

  async function closeQuiz(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    try {
      await updateDoc(doc(db, 'quizzes', quizId), { status: 'closed', closedAt: new Date().toISOString() });
      logAction(db, currentUser.uid, actorName, 'CLOSED_QUIZ', 'admin', `Uzavřel kvíz „${quiz?.title || quizId}“`);
      addToast('success', 'Kvíz uzavřen.');
    } catch (err) {
      console.error('Error closing quiz:', err);
      addToast('error', 'Chyba při uzavírání kvízu.');
    }
  }

  async function duplicateQuiz(quiz) {
    try {
      const key = await loadAnswerKey(quiz.id);
      const { id: _ignored, ...rest } = quiz;
      const ref = await addDoc(collection(db, 'quizzes'), {
        ...rest,
        title: `${quiz.title} (kopie)`,
        status: 'draft',
        deadline: '',
        createdBy: { uid: currentUser.uid, name: actorName },
        createdAt: new Date().toISOString(),
        publishedAt: null,
        closedAt: null,
      });
      await setDoc(doc(db, 'quizAnswerKeys', ref.id), key || { answers: {}, explanations: {} });
      addToast('success', 'Kopie vytvořena jako koncept.');
      return ref.id;
    } catch (err) {
      console.error('Error duplicating quiz:', err);
      addToast('error', 'Chyba při vytváření kopie.');
      return null;
    }
  }

  async function deleteQuiz(quizId) {
    const quiz = quizzes.find(q => q.id === quizId);
    if (quiz?.status !== 'draft') {
      addToast('error', 'Smazat lze pouze koncept. Zveřejněný kvíz uzavřete.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
      await deleteDoc(doc(db, 'quizAnswerKeys', quizId));
      logAction(db, currentUser.uid, actorName, 'DELETED_QUIZ', 'admin', `Smazal koncept kvízu „${quiz.title}“`);
      addToast('success', 'Koncept smazán.');
    } catch (err) {
      console.error('Error deleting quiz:', err);
      addToast('error', 'Chyba při mazání kvízu.');
    }
  }

  return {
    quizzes, loading, canManage,
    createQuiz, updateQuiz, saveAnswerKey, loadAnswerKey,
    publishQuiz, closeQuiz, duplicateQuiz, deleteQuiz, validateForPublish,
  };
}
