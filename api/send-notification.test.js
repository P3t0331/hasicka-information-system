import { describe, it, expect, vi } from 'vitest';

// send-notification.js calls initializeApp()/webpush.setVapidDetails() at
// module load time using real env vars, which aren't present in the test
// environment. Mock the SDK modules so the file can be imported purely to
// reach the pure helpers below — no network/Firestore/webpush calls happen.
vi.mock('firebase-admin/app', () => ({
    initializeApp: vi.fn(),
    cert: vi.fn(),
    getApps: () => [{}],
}));
vi.mock('firebase-admin/firestore', () => ({
    getFirestore: vi.fn(),
    FieldPath: { documentId: vi.fn() },
}));
vi.mock('web-push', () => ({
    default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));

const { chunkArray, resolveAllowedUserIds } = await import('./send-notification.js');

// Fake Firestore-shaped doc: { id, data() } — same shape as a
// QueryDocumentSnapshot returned by `users` collection queries.
function fakeUserDoc(id, preferences) {
    return { id, data: () => ({ preferences }) };
}

describe('resolveAllowedUserIds (category filter, mock Firestore docs)', () => {
    it('excludes a user who explicitly opted out of the category', () => {
        const docs = [fakeUserDoc('u1', { pushCategories: { sluzby: false } })];
        const allowed = resolveAllowedUserIds(docs, 'sluzby');
        expect(allowed.has('u1')).toBe(false);
    });

    it('includes a user with no preferences at all (opt-out-by-default)', () => {
        const docs = [fakeUserDoc('u2', undefined)];
        const allowed = resolveAllowedUserIds(docs, 'sluzby');
        expect(allowed.has('u2')).toBe(true);
    });

    it('includes a user whose pushCategories only sets OTHER categories', () => {
        const docs = [fakeUserDoc('u3', { pushCategories: { kvizy: false, akce: false } })];
        const allowed = resolveAllowedUserIds(docs, 'sluzby');
        expect(allowed.has('u3')).toBe(true);
    });

    it('handles a mixed batch, keeping only users who should receive the category', () => {
        const docs = [
            fakeUserDoc('opted-out', { pushCategories: { sluzby: false } }),
            fakeUserDoc('no-prefs', undefined),
            fakeUserDoc('other-category-off', { pushCategories: { kvizy: false } }),
            fakeUserDoc('opted-in', { pushCategories: { sluzby: true } }),
        ];
        const allowed = resolveAllowedUserIds(docs, 'sluzby');
        expect(allowed.has('opted-out')).toBe(false);
        expect(allowed.has('no-prefs')).toBe(true);
        expect(allowed.has('other-category-off')).toBe(true);
        expect(allowed.has('opted-in')).toBe(true);
        expect(allowed.size).toBe(3);
    });
});

describe('chunkArray (Firestore "in" query 30-value cap)', () => {
    it('returns a single chunk when at or under the limit', () => {
        const ids = Array.from({ length: 30 }, (_, i) => `u${i}`);
        expect(chunkArray(ids, 30)).toEqual([ids]);
    });

    it('splits 35 ids into a 30 + 5 chunk pair covering every id exactly once', () => {
        const ids = Array.from({ length: 35 }, (_, i) => `u${i}`);
        const chunks = chunkArray(ids, 30);
        expect(chunks.length).toBe(2);
        expect(chunks[0].length).toBe(30);
        expect(chunks[1].length).toBe(5);
        expect(chunks.flat()).toEqual(ids);
    });

    it('the category filter still works correctly across chunked candidate ids (65 users, mixed opt-out)', () => {
        const docs = Array.from({ length: 65 }, (_, i) =>
            fakeUserDoc(`u${i}`, i % 10 === 0 ? { pushCategories: { sluzby: false } } : undefined)
        );
        const ids = docs.map(d => d.id);
        const chunks = chunkArray(ids, 30);
        expect(chunks.length).toBe(3);
        expect(chunks.flat()).toEqual(ids);

        const allowed = resolveAllowedUserIds(docs, 'sluzby');
        // Every 10th user (0, 10, 20, ..., 60) opted out => 7 excluded, 58 included.
        const excludedCount = docs.filter(d => !allowed.has(d.id)).length;
        expect(excludedCount).toBe(7);
        expect(allowed.size).toBe(58);
        expect(allowed.has('u0')).toBe(false);
        expect(allowed.has('u10')).toBe(false);
        expect(allowed.has('u1')).toBe(true);
    });
});
