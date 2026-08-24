// Jediné místo v klientovi, odkud se volá /api/send-notification — dřív
// bylo toto tělo zkopírované na devíti místech (useShiftCalendar.js x6,
// useQuizzes.js, CreateTrainingModal.jsx, CreateEventModal.jsx). `category`
// je povinné, protože server podle něj filtruje příjemce podle jejich
// preferences.pushCategories.
export async function sendPushNotification({ title, body, url = '/', tag, category, targetUserId, targetUserIds, targetRoles }) {
    try {
        await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title, body, url, tag, category,
                ...(targetUserId ? { targetUserId } : {}),
                ...(targetUserIds ? { targetUserIds } : {}),
                ...(targetRoles ? { targetRoles } : {}),
            }),
        });
    } catch (err) {
        console.error('Chyba při odesílání notifikace:', err);
    }
}
