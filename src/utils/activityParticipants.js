import { doc, runTransaction } from 'firebase/firestore';

// Atomically adds a participant to an activity (training/event) exactly once.
//
// `participants` is stored as an array of objects and each entry carries a
// `joinedAt` timestamp, so Firestore's arrayUnion cannot deduplicate by uid —
// two rapid clicks (or joins from different entry points / tabs) would each
// append a distinct object and the user would appear twice. This transaction
// reads the committed server list, rejects a duplicate uid, and enforces
// capacity against fresh data instead of stale local React state. Firestore
// retries the transaction on contention, so a second concurrent join re-reads
// the first commit and aborts with ALREADY_JOINED.
//
// Throws an Error with a `code` of 'NOT_FOUND' | 'ALREADY_JOINED' | 'FULL'.
export async function joinActivityTx(db, collectionName, activityId, participant) {
    const ref = doc(db, collectionName, activityId);
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
            throw Object.assign(new Error('Aktivita neexistuje.'), { code: 'NOT_FOUND' });
        }
        const data = snap.data();
        const participants = Array.isArray(data.participants) ? data.participants : [];
        if (participants.some(p => p.uid === participant.uid)) {
            throw Object.assign(new Error('Uživatel je již přihlášen.'), { code: 'ALREADY_JOINED' });
        }
        if (data.maxParticipants && participants.length >= parseInt(data.maxParticipants)) {
            throw Object.assign(new Error('Kapacita je naplněna.'), { code: 'FULL' });
        }
        transaction.update(ref, { participants: [...participants, participant] });
    });
}

// Sets or clears a participant's partial-attendance window (`from`/`until`,
// 'HH:MM'). Empty values remove the key, so "celou dobu" entries look exactly
// like legacy ones. Runs as a transaction on the committed list for the same
// reason as joinActivityTx: the array holds objects, so a targeted update
// isn't possible without rewriting the whole array.
//
// Throws an Error with a `code` of 'NOT_FOUND' | 'NOT_JOINED'.
export async function updateParticipantTimesTx(db, collectionName, activityId, uid, { from, until } = {}) {
    const ref = doc(db, collectionName, activityId);
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
            throw Object.assign(new Error('Aktivita neexistuje.'), { code: 'NOT_FOUND' });
        }
        const participants = Array.isArray(snap.data().participants) ? snap.data().participants : [];
        if (!participants.some(p => p.uid === uid)) {
            throw Object.assign(new Error('Uživatel není přihlášen.'), { code: 'NOT_JOINED' });
        }
        const updated = participants.map(p => {
            if (p.uid !== uid) return p;
            const { from: _f, until: _u, ...rest } = p;
            return {
                ...rest,
                ...(from ? { from } : {}),
                ...(until ? { until } : {}),
            };
        });
        transaction.update(ref, { participants: updated });
    });
}

// Removes a participant by uid. arrayRemove needs a deep-equal object and the
// entry can change after joining (from/until), so a stale local copy would
// silently remove nothing — filter by uid on the committed list instead.
//
// Throws an Error with a `code` of 'NOT_FOUND' | 'NOT_JOINED'.
export async function leaveActivityTx(db, collectionName, activityId, uid) {
    const ref = doc(db, collectionName, activityId);
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) {
            throw Object.assign(new Error('Aktivita neexistuje.'), { code: 'NOT_FOUND' });
        }
        const participants = Array.isArray(snap.data().participants) ? snap.data().participants : [];
        if (!participants.some(p => p.uid === uid)) {
            throw Object.assign(new Error('Uživatel není přihlášen.'), { code: 'NOT_JOINED' });
        }
        transaction.update(ref, { participants: participants.filter(p => p.uid !== uid) });
    });
}
