import { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MEMBER_STATUS, deriveMemberStatus, bestAttempt, isAssignedTo } from '../../shared/quizStatus.js';

/**
 * Kvízy přiřazené přihlášenému členovi a jeho pokusy — pro sekci Kvízy
 * na stránce Školení.
 */
export default function useMyQuizzes() {
    const { currentUser, userData } = useAuth();
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [trainings, setTrainings] = useState([]);
    const [quizzesLoaded, setQuizzesLoaded] = useState(false);
    const [attemptsLoaded, setAttemptsLoaded] = useState(false);
    const [trainingsLoaded, setTrainingsLoaded] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'quizzes'), (snapshot) => {
            const data = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(q => q.status === 'published');
            setQuizzes(data);
            setQuizzesLoaded(true);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        // Bez přihlášeného uživatele nemá smysl kolekci sledovat (a where by dostal undefined) —
        // stránka je za PrivateRoute, takže currentUser bude v praxi vždy k dispozici.
        if (!currentUser?.uid) return undefined;
        const attemptsQuery = query(collection(db, 'quizAttempts'), where('uid', '==', currentUser.uid));
        const unsubscribe = onSnapshot(attemptsQuery, (snapshot) => {
            setAttempts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setAttemptsLoaded(true);
        });
        return unsubscribe;
    }, [currentUser?.uid]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'trainings'), (snapshot) => {
            setTrainings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setTrainingsLoaded(true);
        });
        return unsubscribe;
    }, []);

    const myQuizzes = useMemo(() => {
        if (!currentUser?.uid) return [];
        const member = { ...userData, uid: currentUser.uid };

        return quizzes
            .map(quiz => {
                const myAttempts = attempts.filter(a => a.quizId === quiz.id);
                const training = quiz.assignment?.mode === 'training' && quiz.trainingId
                    ? trainings.find(t => t.id === quiz.trainingId) || null
                    : null;

                // Past u kvízu v režimu 'training': smazané školení => isAssignedTo vrátí false.
                // Odevzdaný/rozpracovaný kvíz nesmí zmizet z historie člena, proto ho ukážeme,
                // pokud pro něj člen už má alespoň jeden pokus.
                const assigned = isAssignedTo(quiz, member, training) || myAttempts.length > 0;
                if (!assigned) return null;

                const myStatus = deriveMemberStatus(myAttempts);
                const myBest = bestAttempt(myAttempts);
                const attemptsUsed = myAttempts.length;
                const canStart = myStatus !== MEMBER_STATUS.PASSED
                    && quiz.status !== 'closed'
                    && (quiz.maxAttempts === 0 || attemptsUsed < quiz.maxAttempts);

                return { ...quiz, myAttempts, myStatus, myBest, attemptsUsed, canStart };
            })
            .filter(Boolean);
    }, [quizzes, attempts, trainings, currentUser, userData]);

    return {
        myQuizzes,
        loading: !(quizzesLoaded && attemptsLoaded && trainingsLoaded),
    };
}
