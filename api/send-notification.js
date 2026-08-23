import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();

    const { title, body, url, tag, category, targetUserId, targetUserIds, targetRoles } = req.body || {};
    if (!title) return res.status(400).json({ error: 'missing title' });

    const db = getFirestore();
    const subs = await db.collection('pushSubscriptions').get();
    const payload = JSON.stringify({ title, body: body || '', url: url || '/' });

    let docs;
    if (targetUserId) {
        docs = subs.docs.filter(d => d.data().userId === targetUserId || d.id === targetUserId || d.id.startsWith(targetUserId + '_'));
    } else if (targetUserIds && targetUserIds.length > 0) {
        const wanted = new Set(targetUserIds);
        docs = subs.docs.filter(d => wanted.has(d.data().userId));
    } else if (targetRoles && targetRoles.length > 0) {
        const usersSnap = await db.collection('users').where('roles', 'array-contains-any', targetRoles).get();
        const targetUids = new Set(usersSnap.docs.map(d => d.id));
        docs = subs.docs.filter(d => targetUids.has(d.data().userId));
    } else {
        docs = subs.docs;
    }

    if (category) {
        const candidateUserIds = [...new Set(docs.map(d => d.data().userId).filter(Boolean))];
        if (candidateUserIds.length > 0) {
            // Firestore 'in' queries cap at 30 values per query — chunk if a
            // broadcast (targetRoles/no target) ever exceeds that.
            const chunks = [];
            for (let i = 0; i < candidateUserIds.length; i += 30) {
                chunks.push(candidateUserIds.slice(i, i + 30));
            }
            const userDocs = (await Promise.all(
                chunks.map(chunk => db.collection('users').where(FieldPath.documentId(), 'in', chunk).get())
            )).flatMap(snap => snap.docs);
            const allowedUserIds = new Set(
                userDocs
                    .filter(d => shouldReceivePush(d.data().preferences, category))
                    .map(d => d.id)
            );
            docs = docs.filter(d => allowedUserIds.has(d.data().userId));
        }
    }

    await Promise.allSettled(
        docs.map(async (docSnap) => {
            try {
                await webpush.sendNotification(docSnap.data().subscription, payload);
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await docSnap.ref.delete();
                }
            }
        })
    );

    res.status(200).json({ ok: true, count: docs.length });
}
