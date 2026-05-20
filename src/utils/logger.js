import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Logs a user action to the activityLogs Firestore collection.
 * Fire-and-forget — does not throw on failure so it never disrupts the UI.
 *
 * @param {object} db - Firestore instance
 * @param {string} uid - UID of the acting user
 * @param {string} userName - Full name of the acting user
 * @param {string} action - Machine-readable action key (e.g. "JOINED_SHIFT")
 * @param {string} category - "shifts" | "activities" | "maintenance" | "cleaning" | "profile" | "admin"
 * @param {string} detail - Human-readable Czech description of what happened
 */
export const logAction = async (db, uid, userName, action, category, detail) => {
    try {
        await addDoc(collection(db, 'activityLogs'), {
            uid,
            userName,
            action,
            category,
            detail,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        // Log silently — never break the main action
        console.warn('[Logger] Failed to write activity log:', err);
    }
};
