import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { gradeAttempt, computeScorePercent, isPassed } from '../shared/quizScoring.js';
import { isLateSubmission, isTimeExpired } from '../shared/quizStatus.js';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'missing token' });

    let uid;
    try {
        uid = (await getAuth().verifyIdToken(token)).uid;
    } catch {
        return res.status(401).json({ error: 'invalid token' });
    }

    const { quizId, attemptId } = req.body || {};
    if (!quizId || !attemptId) return res.status(400).json({ error: 'missing quizId or attemptId' });

    const db = getFirestore();
    const quizRef = db.collection('quizzes').doc(quizId);
    const keyRef = db.collection('quizAnswerKeys').doc(quizId);
    const attemptRef = db.collection('quizAttempts').doc(attemptId);

    // The read-check-write for "is this attempt still in_progress" runs inside a
    // Firestore transaction so two concurrent submissions of the same attempt
    // (double-click, retry, or an auto-submit racing a manual one) cannot both
    // pass the status check: the second commit is rejected and retried by the
    // Admin SDK, at which point it observes the already-submitted status and
    // falls into the 409 branch below instead of grading twice.
    let outcome;
    try {
        outcome = await db.runTransaction(async (tx) => {
            const [quizSnap, keySnap, attemptSnap] = await Promise.all([
                tx.get(quizRef),
                tx.get(keyRef),
                tx.get(attemptRef),
            ]);

            if (!quizSnap.exists) return { error: { status: 404, body: { error: 'quiz not found' } } };
            if (!attemptSnap.exists) return { error: { status: 404, body: { error: 'attempt not found' } } };

            const quiz = quizSnap.data();
            const attempt = attemptSnap.data();

            // Ownership check: never grade or reveal another member's attempt.
            if (attempt.uid !== uid) return { error: { status: 403, body: { error: 'forbidden' } } };
            if (attempt.quizId !== quizId) {
                return { error: { status: 400, body: { error: 'attempt does not belong to quiz' } } };
            }
            // Re-submission guard: also the transactional race guard described above.
            if (attempt.status !== 'in_progress') return { error: { status: 409, body: { error: 'already submitted' } } };

            const answerKey = keySnap.exists ? keySnap.data() : { answers: {}, explanations: {} };

            const now = new Date().toISOString();
            // timeExpired is derived from the server clock only — the client never
            // supplies "now", so it cannot lie about how much time has elapsed.
            const timeExpired = isTimeExpired(attempt.startedAt, quiz.timeLimitMinutes, now);

            // Grading is always recomputed here from the attempt's raw `answers`
            // (as read server-side, never from the request body) plus the answer
            // key. Any score-shaped fields already present on the attempt document
            // (scorePercent, passed, questionCount, ...) are ignored on purpose —
            // a member can only ever write `answers`/`lastSavedAt` per the Firestore
            // rules, but this endpoint must not trust them even so.
            const graded = gradeAttempt(quiz, answerKey, attempt.answers || {});
            const hasManual = graded.manualQuestionIds.length > 0;
            const scorePercent = computeScorePercent({
                questionCount: graded.questionCount,
                autoCorrectCount: graded.autoCorrectCount,
                manualGrades: {},
            });
            const isLate = isLateSubmission(quiz.deadline, now);
            const passed = hasManual ? null : isPassed(scorePercent, quiz.passThreshold);

            const update = {
                status: hasManual ? 'pending_review' : (passed ? 'passed' : 'failed'),
                submittedAt: now,
                isLate,
                timeExpired,
                questionCount: graded.questionCount,
                autoCorrectCount: graded.autoCorrectCount,
                manualGrades: {},
                scorePercent: hasManual ? null : scorePercent,
                passed,
            };

            tx.update(attemptRef, update);

            const reveal = quiz.showCorrectAnswers === true;
            return {
                ok: {
                    status: update.status,
                    scorePercent: update.scorePercent,
                    passed: update.passed,
                    isLate,
                    timeExpired,
                    perQuestion: reveal ? graded.perQuestion : null,
                    correctAnswers: reveal ? answerKey.answers : null,
                    explanations: reveal ? (answerKey.explanations || {}) : null,
                },
            };
        });
    } catch {
        return res.status(500).json({ error: 'internal error' });
    }

    if (outcome.error) return res.status(outcome.error.status).json(outcome.error.body);
    return res.status(200).json(outcome.ok);
}
