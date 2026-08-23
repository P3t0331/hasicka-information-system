import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import webpush from 'web-push';
import {
    isAssignedTo,
    deriveMemberStatus,
    pragueDateString,
    MEMBER_STATUS,
} from '../shared/quizStatus.js';
import { shouldReceivePush } from '../shared/preferences.js';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VITE_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// Kolik dní před termínem se posílá připomínka. Tady, ne v poli konfigurace
// kvízu — pravidlo je stejné pro celou jednotku.
const REMINDER_DAYS = [3, 1];

// `deadline` i `todayPrague` jsou datumové řetězce 'YYYY-MM-DD' (žádné
// časové pásmo v zápisu), takže je JS parsuje shodně podle lokálního času
// běhového prostředí (na Vercelu UTC) — tenhle posun je pro OBĚ hodnoty
// stejný, takže se v rozdílu vyruší. Stejný trik používá klient (viz
// QuizWidget.jsx/QuizCard.jsx getCountdown) — `todayPrague` sem ale musí
// přijít z `pragueDateString`, jinak by "dnes" bylo o hodiny posunuté podle
// UTC, ne podle pražského času, a v části dne by vycházel jiný den než ve
// skutečnosti.
function daysUntilDeadline(deadline, todayPrague) {
    const deadlineMs = new Date(`${deadline}T00:00:00`).getTime();
    const todayMs = new Date(`${todayPrague}T00:00:00`).getTime();
    return Math.round((deadlineMs - todayMs) / 86400000);
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'GET') return res.status(405).end();

    const db = getFirestore();
    const todayPrague = pragueDateString(new Date().toISOString());

    const quizzesSnap = await db.collection('quizzes').where('status', '==', 'published').get();

    // Kandidáti: kvízy, kterým dnes (v pražském čase) zbývají přesně 3 nebo 1
    // den do termínu a ještě nedostaly připomínku pro tenhle počet dní.
    // `lastReminderSentFor === daysLeft` je jediné, co dělá druhé spuštění
    // ve stejný den (ruční i náhodou zdvojený cron) no-opem.
    const candidates = [];
    quizzesSnap.docs.forEach((docSnap) => {
        const quiz = { id: docSnap.id, ...docSnap.data() };
        if (!quiz.deadline) return;
        const daysLeft = daysUntilDeadline(quiz.deadline, todayPrague);
        if (!REMINDER_DAYS.includes(daysLeft)) return;
        if (quiz.lastReminderSentFor === daysLeft) return;
        candidates.push({ ref: docSnap.ref, quiz, daysLeft });
    });

    if (candidates.length === 0) {
        return res.status(200).json({ ok: true, quizzes: 0, notified: 0 });
    }

    // `users`, `trainings` a `pushSubscriptions` se pro tenhle běh nemění
    // podle kvízu, proto se načtou jednou dopředu a sdílejí mezi kandidáty —
    // na velikost jednotky zanedbatelné navíc oproti opakovanému čtení.
    // `quizAttempts` se naopak načítají zvlášť pro každý kvíz přes `where`
    // (níž), protože ta kolekce roste s počtem pokusů napříč všemi kvízy a
    // pro připomínku jednoho kvízu je potřeba jen jeho vlastní podmnožina.
    const [usersSnap, trainingsSnap, subsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('trainings').get(),
        db.collection('pushSubscriptions').get(),
    ]);
    const members = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const trainings = trainingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let quizzesProcessed = 0;
    let notified = 0;

    for (const { ref, quiz, daysLeft } of candidates) {
        // Zpracování jednoho kvízu je izolované: chyba tady (načtení pokusů,
        // zápis lastReminderSentFor, ...) se zaloguje a přeskočí na další
        // kandidát, ale kvízu se NEZAPÍŠE lastReminderSentFor, takže se o
        // připomínku pokusí znovu příští běh. Jednotlivá nedoručitelná push
        // předplatná uvnitř sendNotification se řeší zvlášť (níž) a tenhle
        // catch nespouští — jeden mrtvý telefon nesmí zablokovat zbytek
        // jednotky ani ostatní kvízy.
        try {
            const training = quiz.assignment?.mode === 'training' && quiz.trainingId
                ? trainings.find(t => t.id === quiz.trainingId) || null
                : null;

            const attemptsSnap = await db.collection('quizAttempts').where('quizId', '==', quiz.id).get();
            const attemptsByUid = new Map();
            attemptsSnap.docs.forEach((d) => {
                const attempt = d.data();
                if (!attemptsByUid.has(attempt.uid)) attemptsByUid.set(attempt.uid, []);
                attemptsByUid.get(attempt.uid).push(attempt);
            });

            const targetUserIds = members
                .filter(member => isAssignedTo(quiz, member, training))
                .filter(member => deriveMemberStatus(attemptsByUid.get(member.uid) || []) !== MEMBER_STATUS.PASSED)
                .filter(member => shouldReceivePush(member.preferences, 'kvizy'))
                .map(member => member.uid);

            // Zapsat PŘED odesláním, ne po něm — záměrně. Kdyby se posílalo
            // první a tenhle zápis pak selhal (přechodná chyba Firestore,
            // timeout), notifikace by už byly venku, ale kvíz by zůstal
            // neoznačený, takže by ho příští běh považoval za nového
            // kandidáta a poslal by úplně stejnou dávku podruhé — přesně to
            // hromadné zdvojení, kterému má lastReminderSentFor zabránit.
            // V tomhle pořadí je nejhorší případ selhání zápisu jen to, že
            // se pošta vůbec nepošle (zachytí ji vnější catch, kvíz zůstane
            // kandidátem a zkusí se znovu příští běh) — nikdy ne, že se
            // pošle dvakrát. A selže-li až samotné odeslání PO úspěšném
            // zápisu, kvíz už je označený a je to jednorázově nedoručená
            // připomínka, ne opakovaný spam.
            await ref.update({ lastReminderSentFor: daysLeft });

            if (targetUserIds.length > 0) {
                const wanted = new Set(targetUserIds);
                const payload = JSON.stringify({
                    title: 'Připomínka kvízu',
                    body: `Připomínka: kvíz „${quiz.title}“ je třeba splnit do ${quiz.deadline}.`,
                    url: '/skoleni',
                });

                await Promise.allSettled(
                    subsSnap.docs
                        .filter(d => wanted.has(d.data().userId))
                        .map(async (docSnap) => {
                            try {
                                await webpush.sendNotification(docSnap.data().subscription, payload);
                            } catch (err) {
                                if (err.statusCode === 410 || err.statusCode === 404) {
                                    await docSnap.ref.delete();
                                } else {
                                    console.error(`Push send failed for quiz ${quiz.id}:`, err);
                                }
                            }
                        })
                );
            }

            quizzesProcessed += 1;
            notified += targetUserIds.length;
        } catch (err) {
            console.error(`Failed to process reminder for quiz ${quiz.id}:`, err);
        }
    }

    return res.status(200).json({ ok: true, quizzes: quizzesProcessed, notified });
}
