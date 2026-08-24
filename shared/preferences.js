// shared/preferences.js
//
// Sdílená čistá logika nad uživatelskými preferencemi — čte ji klient
// (Nastavení, Dashboard) i serverless funkce, které rozesílají push
// (api/send-notification.js, api/quiz-reminders.js). Bez preferences
// nebo s částečně vyplněnou preferences se vždy chová jako dosud
// (žádná migrace existujících uživatelů).

export const DEFAULT_DASHBOARD_WIDGET_ORDER = [
  'bulletin', 'importantLinks', 'nextShift', 'quiz', 'upcomingActivities', 'monthlyStats', 'myAbsences',
];

export const DEFAULT_PREFERENCES = {
  theme: 'system',
  landingPage: 'dashboard',
  dashboardWidgets: { order: DEFAULT_DASHBOARD_WIDGET_ORDER, hidden: [] },
  pushCategories: { kvizy: true, sluzby: true, skoleni: true, akce: true },
};

export function getTheme(preferences) {
  return preferences?.theme || DEFAULT_PREFERENCES.theme;
}

export function getLandingPage(preferences) {
  return preferences?.landingPage || DEFAULT_PREFERENCES.landingPage;
}

export function getDashboardWidgetOrder(preferences, allWidgetIds) {
  const stored = preferences?.dashboardWidgets;
  const hidden = new Set(stored?.hidden || []);
  const storedOrder = stored?.order || allWidgetIds;

  const known = storedOrder.filter(id => allWidgetIds.includes(id));
  const missing = allWidgetIds.filter(id => !known.includes(id));

  return [...known, ...missing].filter(id => !hidden.has(id));
}

export function shouldReceivePush(preferences, category) {
  const stored = preferences?.pushCategories?.[category];
  return stored === undefined ? true : stored;
}
