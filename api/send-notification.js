import webpush from 'web-push';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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

    const { title, body, url, tag, targetUserId } = req.body || {};
    if (!title) return res.status(400).json({ error: 'missing title' });

    const db = getFirestore();
    const subs = await db.collection('pushSubscriptions').get();
    const payload = JSON.stringify({ title, body: body || '', url: url || '/' });

    const docs = targetUserId
        ? subs.docs.filter(d => d.data().userId === targetUserId)
        : subs.docs;

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
