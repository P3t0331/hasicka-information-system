# Nastavení profilu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Nastavení" section to Profile letting members pick a light/dark theme, a default landing page, which dashboard widgets they see (and in what order), and which push-notification categories they receive — backed by one `preferences` map on the user's Firestore doc, plus a full app-wide retheme so dark mode actually works everywhere.

**Architecture:** A new `shared/preferences.js` module (pure logic, imported by client and by the two serverless functions that send push, mirroring how `shared/quizStatus.js` already works) resolves defaults and answers "should widget X show", "should category Y receive push". `index.css` gains a full semantic color-token palette with light/dark values; every component's hardcoded hex colors are converted to reference those tokens. A new `ThemeContext` applies the active theme via a `data-theme` attribute, primed by an inline pre-paint script in `index.html` to avoid a flash of the wrong theme.

**Tech Stack:** React 19, Firebase Firestore (client SDK + Admin SDK in `api/`), Vitest for `shared/` unit tests, no new dependencies.

## Global Constraints

- Preferences live at `users/{uid}.preferences` — no new Firestore collection. Existing catch-all security rule (`firestore.rules:20-25`) already permits signed-in writes to any document outside `quizzes`/`quizAnswerKeys`/`quizAttempts`, so no rules change is needed.
- Missing `preferences` (or any sub-field) always resolves to the defaults in `shared/preferences.js` — no migration script, no forced write on login.
- All new UI copy is Czech, matching the rest of the app.
- Changes in the Nastavení section save immediately on interaction (no Save button), matching `EquipmentSection`'s existing pattern.
- Dashboard alert banners (`WeatherWarnings`, `NewActivitiesBanner`, `ZalohaNotificationBanner`) are never configurable — always render.
- Landing-page choices are limited to: Dashboard (`/`), Služby (`/shifts`), Školení (`/skoleni`), Kvízy (`/skoleni` + scroll to the kvízy section).
- Push categories are: `kvizy`, `sluzby`, `skoleni`, `akce` — matching the 4 places push is triggered today.
- Retheme is opt-out by omission: any hex color left unconverted is a bug, not an acceptable gap — this plan's retheme tasks cover all 85 files identified as containing hardcoded hex colors (verified via `grep -rlE "#[0-9a-fA-F]{3,6}" src --include=*.jsx`).

---

## File Structure

**New files:**
- `shared/preferences.js` — pure logic: defaults, widget resolution, push-category check
- `shared/preferences.test.js` — Vitest tests for the above
- `src/contexts/ThemeContext.jsx` — resolves and applies the active theme
- `src/components/profile/SettingsSection.jsx` — the four-part Nastavení UI
- `src/utils/pushNotification.js` — shared client-side `sendPushNotification(payload)` helper (replaces ~9 duplicated inline `fetch('/api/send-notification', ...)` call sites)

**Modified files (foundation/features):**
- `index.html` — pre-paint theme script
- `src/App.jsx` — wrap tree in `ThemeProvider`
- `src/index.css` — full semantic color-token palette (light + dark)
- `src/pages/ProfilePage.jsx` — render `SettingsSection`; convert its inline hex colors
- `src/pages/DashboardPage.jsx` — configurable widget order/visibility; landing-page redirect; convert inline hex colors
- `src/pages/TrainingsPage.jsx` — add `id="kvizy-sekce"` anchor for the Kvízy landing option
- `src/hooks/useQuizzes.js`, `src/hooks/useShiftCalendar.js`, `src/components/trainings/CreateTrainingModal.jsx`, `src/components/events/CreateEventModal.jsx` — route push sends through `sendPushNotification` with a `category`
- `api/send-notification.js`, `api/quiz-reminders.js` — filter recipients by `preferences.pushCategories`

**Modified files (retheme only — hardcoded hex → CSS variables, no logic change):**
All 85 files listed in Phase 2 below.

---

## Phase 0: Shared preferences logic

### Task 1: `shared/preferences.js` — defaults and pure resolution logic

**Files:**
- Create: `shared/preferences.js`
- Test: `shared/preferences.test.js`

**Interfaces:**
- Produces:
  - `DEFAULT_PREFERENCES` — the object shape below
  - `getTheme(preferences)` → `'light' | 'dark' | 'system'`
  - `getLandingPage(preferences)` → `'dashboard' | 'sluzby' | 'skoleni' | 'kvizy'`
  - `getDashboardWidgetOrder(preferences, allWidgetIds)` → `string[]` (visible widget ids, in order, defaults filled in for ids missing from a stored order)
  - `shouldReceivePush(preferences, category)` → `boolean`

- [ ] **Step 1: Write the failing tests**

```js
// shared/preferences.test.js
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  getTheme,
  getLandingPage,
  getDashboardWidgetOrder,
  shouldReceivePush,
} from './preferences.js';

const ALL_WIDGETS = ['bulletin', 'nextShift', 'quiz', 'monthlyStats', 'upcomingActivities', 'myAbsences', 'importantLinks'];

describe('DEFAULT_PREFERENCES', () => {
  it('has theme system, landingPage dashboard, all widgets visible in default order, all push categories on', () => {
    expect(DEFAULT_PREFERENCES.theme).toBe('system');
    expect(DEFAULT_PREFERENCES.landingPage).toBe('dashboard');
    expect(DEFAULT_PREFERENCES.dashboardWidgets).toEqual({ order: ALL_WIDGETS, hidden: [] });
    expect(DEFAULT_PREFERENCES.pushCategories).toEqual({ kvizy: true, sluzby: true, skoleni: true, akce: true });
  });
});

describe('getTheme', () => {
  it('returns system when preferences is undefined', () => {
    expect(getTheme(undefined)).toBe('system');
  });
  it('returns the stored theme', () => {
    expect(getTheme({ theme: 'dark' })).toBe('dark');
  });
});

describe('getLandingPage', () => {
  it('returns dashboard when preferences is undefined', () => {
    expect(getLandingPage(undefined)).toBe('dashboard');
  });
  it('returns the stored value', () => {
    expect(getLandingPage({ landingPage: 'kvizy' })).toBe('kvizy');
  });
});

describe('getDashboardWidgetOrder', () => {
  it('returns all widgets in the default order when preferences is undefined', () => {
    expect(getDashboardWidgetOrder(undefined, ALL_WIDGETS)).toEqual(ALL_WIDGETS);
  });

  it('respects a stored custom order', () => {
    const prefs = { dashboardWidgets: { order: ['quiz', 'bulletin'], hidden: [] } };
    expect(getDashboardWidgetOrder(prefs, ['bulletin', 'quiz'])).toEqual(['quiz', 'bulletin']);
  });

  it('excludes hidden widgets', () => {
    const prefs = { dashboardWidgets: { order: ALL_WIDGETS, hidden: ['myAbsences'] } };
    expect(getDashboardWidgetOrder(prefs, ALL_WIDGETS)).not.toContain('myAbsences');
  });

  it('appends widgets missing from a stale stored order (e.g. a widget added after the user saved their order)', () => {
    const prefs = { dashboardWidgets: { order: ['quiz', 'bulletin'], hidden: [] } };
    expect(getDashboardWidgetOrder(prefs, ['bulletin', 'quiz', 'importantLinks'])).toEqual(['quiz', 'bulletin', 'importantLinks']);
  });

  it('drops ids from the stored order that no longer exist in allWidgetIds', () => {
    const prefs = { dashboardWidgets: { order: ['quiz', 'retiredWidget', 'bulletin'], hidden: [] } };
    expect(getDashboardWidgetOrder(prefs, ['bulletin', 'quiz'])).toEqual(['quiz', 'bulletin']);
  });
});

describe('shouldReceivePush', () => {
  it('returns true for every category when preferences is undefined', () => {
    expect(shouldReceivePush(undefined, 'kvizy')).toBe(true);
    expect(shouldReceivePush(undefined, 'sluzby')).toBe(true);
  });

  it('returns false when the category is explicitly disabled', () => {
    expect(shouldReceivePush({ pushCategories: { kvizy: false } }, 'kvizy')).toBe(false);
  });

  it('returns true for a category not present in a partial pushCategories object', () => {
    expect(shouldReceivePush({ pushCategories: { kvizy: false } }, 'akce')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/preferences.test.js`
Expected: FAIL — `shared/preferences.js` does not exist yet.

- [ ] **Step 3: Implement `shared/preferences.js`**

```js
// shared/preferences.js
//
// Sdílená čistá logika nad uživatelskými preferencemi — čte ji klient
// (Nastavení, Dashboard) i serverless funkce, které rozesílají push
// (api/send-notification.js, api/quiz-reminders.js). Bez preferences
// nebo s částečně vyplněnou preferences se vždy chová jako dosud
// (žádná migrace existujících uživatelů).

export const DEFAULT_DASHBOARD_WIDGET_ORDER = [
  'bulletin', 'nextShift', 'quiz', 'monthlyStats', 'upcomingActivities', 'myAbsences', 'importantLinks',
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/preferences.test.js`
Expected: PASS (all cases above)

- [ ] **Step 5: Commit**

```bash
git add shared/preferences.js shared/preferences.test.js
git commit -m "feat: add shared preferences resolution logic"
```

---

## Phase 1: Theme infrastructure

### Task 2: Color-token palette in `index.css`

**Files:**
- Modify: `src/index.css:9-32` (existing `:root` block)

**Interfaces:**
- Produces: the full set of CSS custom properties every later retheme task (Phase 2) converts hardcoded hex colors into. Names below are final — do not rename in later tasks.

- [ ] **Step 1: Replace the `:root` block**

Replace lines 9-32 of `src/index.css` (existing `:root { ... }`) with:

```css
:root {
  /* Brand (existing — unchanged) */
  --primary-red: #D32F2F;
  --primary-red-dark: #B71C1C;

  /* Base surfaces */
  --bg-light: #F5F7FA;
  --bg-dark: #121212;
  --bg-dark-paper: #1E1E1E;
  --surface: #ffffff;
  --surface-alt: #f5f5f5;
  --surface-hover: #f0f0f0;
  --surface-sunken: #fafafa;

  /* Text */
  --text-primary: #1A1A1A;
  --text-secondary: #555555;
  --text-muted: #888888;
  --text-on-dark: #FFFFFF;

  /* Borders */
  --border: #e0e0e0;
  --border-strong: #bbbbbb;

  /* Status: danger (red) */
  --danger: #d32f2f;
  --danger-dark: #b71c1c;
  --danger-text: #c62828;
  --danger-bg: #ffebee;
  --danger-border: #ffcdd2;

  /* Status: success (green) */
  --success: #388e3c;
  --success-dark: #1b5e20;
  --success-text: #2e7d32;
  --success-bg: #e8f5e9;
  --success-border: #c8e6c9;

  /* Status: warning (amber/orange) */
  --warning: #f57c00;
  --warning-dark: #e65100;
  --warning-text: #ef6c00;
  --warning-bg: #fff3e0;
  --warning-border: #ffcc80;

  /* Status: info (blue) */
  --info: #1976d2;
  --info-dark: #0d47a1;
  --info-text: #1565c0;
  --info-bg: #e3f2fd;
  --info-border: #90caf9;

  /* Accent: purple (used for a few badge/category colors) */
  --accent-purple: #7b1fa2;
  --accent-purple-bg: #f3e5f5;
  --accent-purple-border: #e1bee7;

  /* Accent: neutral/blue-grey (secondary badges) */
  --neutral: #546e7a;
  --neutral-bg: #eceff1;

  /* Glass effect (existing usage found in ProfilePage) */
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: 1px solid rgba(0, 0, 0, 0.06);
  --radius: 12px;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.08);
}

:root[data-theme='dark'] {
  --bg-light: #121212;
  --surface: #1E1E1E;
  --surface-alt: #262626;
  --surface-hover: #2c2c2c;
  --surface-sunken: #181818;

  --text-primary: #F0F0F0;
  --text-secondary: #b0b0b0;
  --text-muted: #8a8a8a;

  --border: #333333;
  --border-strong: #4a4a4a;

  --danger-bg: #3a1414;
  --danger-border: #5c1f1f;
  --success-bg: #10261a;
  --success-border: #1c3d29;
  --warning-bg: #332210;
  --warning-border: #4d341a;
  --info-bg: #10233a;
  --info-border: #1c3a5c;
  --accent-purple-bg: #2a1830;
  --accent-purple-border: #402349;
  --neutral-bg: #23282b;

  --glass-bg: rgba(30, 30, 30, 0.7);
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.4);
}
```

Existing rules already referencing `--bg-light`, `--text-primary`, `--primary-red`, `--primary-red-dark`, `--glass-bg`, `--glass-border`, `--radius`, `--shadow-soft` (all pre-existing names) continue to work unchanged — this step only adds new tokens and a dark override block, it does not remove or rename anything in use.

- [ ] **Step 2: Verify the app still builds and looks unchanged in light mode**

Run: `npm run build`
Expected: build succeeds. Then `npm run dev`, open the app — since `data-theme` is never set yet, appearance must be pixel-identical to before this change (the dark override block only applies under `[data-theme='dark']`, which nothing sets yet).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add semantic color-token palette with dark variant"
```

---

### Task 3: `ThemeContext` + pre-paint script

**Files:**
- Create: `src/contexts/ThemeContext.jsx`
- Modify: `index.html:16-20`
- Modify: `src/App.jsx` (wrap provider tree)

**Interfaces:**
- Consumes: `getTheme(preferences)` from `shared/preferences.js` (Task 1)
- Produces: `ThemeProvider` component; `useTheme()` hook returning `{ resolvedTheme }` (`'light' | 'dark'`, `'system'` already resolved against `prefers-color-scheme`)

- [ ] **Step 1: Add the pre-paint script to `index.html`**

Replace the `<head>` block's closing (right before `</head>`, after the existing `<title>` tag at line 15) by inserting this script:

```html
    <title>Hasičský IS</title>
    <script>
      (function () {
        try {
          var cached = localStorage.getItem('theme-preference') || 'system';
          var resolved = cached === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : cached;
          document.documentElement.setAttribute('data-theme', resolved);
        } catch (e) { /* localStorage unavailable — default light stays in effect */ }
      })();
    </script>
```

`theme-preference` in `localStorage` is a client-only cache of `preferences.theme` written by `ThemeContext` once Firestore data loads — it exists purely to avoid a flash of the wrong theme before React mounts and Firestore data arrives.

- [ ] **Step 2: Create `src/contexts/ThemeContext.jsx`**

```jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getTheme } from '../../shared/preferences.js';

const ThemeContext = createContext(null);

function resolveSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const { userData } = useAuth();
  const storedTheme = getTheme(userData?.preferences);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    storedTheme === 'system' ? resolveSystemTheme() : storedTheme
  );

  useEffect(() => {
    const next = storedTheme === 'system' ? resolveSystemTheme() : storedTheme;
    setResolvedTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme-preference', storedTheme);
    } catch (e) { /* localStorage unavailable — pre-paint cache just won't update */ }
  }, [storedTheme]);

  useEffect(() => {
    if (storedTheme !== 'system' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const next = resolveSystemTheme();
      setResolvedTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [storedTheme]);

  return (
    <ThemeContext.Provider value={{ resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

- [ ] **Step 3: Wrap the app tree in `src/App.jsx`**

In `src/App.jsx`, add the import next to the existing `ToastProvider` import:

```js
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
```

Then wrap `<ToastProvider>` around `<ThemeProvider>` (Theme needs `userData` from `AuthProvider`, which already wraps everything, so nesting order relative to Toast doesn't matter — pick Toast outside, Theme inside for readability):

```jsx
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <Router>
          {/* ...existing content unchanged... */}
          </Router>
        </ThemeProvider>
      </ToastProvider>
      <Analytics />
    </AuthProvider>
  );
}
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open the app, log in. In the browser console run `document.documentElement.getAttribute('data-theme')` — expect `'light'` (no `preferences` saved yet, system defaults to light unless the OS is in dark mode). Confirm no console errors from `ThemeProvider`.

- [ ] **Step 5: Commit**

```bash
git add index.html src/App.jsx src/contexts/ThemeContext.jsx
git commit -m "feat: add ThemeContext with pre-paint theme script"
```

---

## Phase 2: Full-app retheme

**Process for every task in this phase** (stated once here, referenced by each task below instead of repeating):

1. Run `grep -noE "#[0-9a-fA-F]{3,6}" <file>` to list every hex color and its line.
2. For each match, find the nearest token from Task 2's palette by role:
   - Backgrounds/surfaces → `--surface`, `--surface-alt`, `--surface-hover`, `--surface-sunken`, `--bg-light`
   - Body/heading text → `--text-primary`; secondary/caption text → `--text-secondary`; placeholder/disabled text → `--text-muted`
   - Borders/dividers → `--border` or `--border-strong`
   - Red-family badges/alerts (`#d32f2f`, `#c62828`, `#e53935`, `#ffcdd2`, `#ffebee`, `#b71c1c`, ...) → the matching `--danger*` token
   - Green-family (`#2e7d32`, `#388e3c`, `#4caf50`, `#81c784`, `#c8e6c9`, `#e8f5e9`, `#1b5e20`, ...) → `--success*`
   - Orange/amber-family (`#e65100`, `#f57c00`, `#ff9800`, `#ffb300`, `#ffc107`, `#fff3e0`, `#fff8e1`, `#ef6c00`, `#ffa000`, `#ffcc80`, ...) → `--warning*`
   - Blue-family (`#1565c0`, `#1976d2`, `#2196f3`, `#90caf9`, `#bbdefb`, `#e3f2fd`, `#0d47a1`, `#1e88e5`, ...) → `--info*`
   - Purple-family (`#7b1fa2`, `#9c27b0`, `#6a1b9a`, `#f3e5f5`, `#e1bee7`, ...) → `--accent-purple*`
   - Blue-grey/neutral badges (`#546e7a`, `#455a64`, `#37474f`, `#eceff1`, ...) → `--neutral`/`--neutral-bg`
   - Pure white (`#fff`/`#ffffff`) used as text-on-dark-background → `--text-on-dark`; used as a surface → `--surface`
3. If a color's role genuinely doesn't fit any existing token (rare — e.g. a one-off decorative gradient stop), add a new named token to the `:root` / `:root[data-theme='dark']` blocks in `src/index.css` (both light and dark values) rather than leaving it hardcoded, and use that.
4. Replace each hex literal with `var(--token-name)`. In JS/JSX (`style={{ color: '#d32f2f' }}`), this becomes `style={{ color: 'var(--danger)' }}` — CSS custom properties work the same inside inline `style` objects.
5. Verify: `grep -noE "#[0-9a-fA-F]{3,6}" <file>` returns nothing.
6. Run `npm run build` (catches syntax errors) and `npm run lint`.
7. Commit.

### Task 4: Retheme — Profile pages and components

**Files:**
- Modify: `src/pages/ProfilePage.jsx`, `src/components/profile/EquipmentModal.jsx`, `src/components/profile/EquipmentSection.jsx`, `src/components/profile/ProfileInfo.jsx`, `src/components/profile/QuizHistory.jsx`

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -noE "#[0-9a-fA-F]{3,6}" src/pages/ProfilePage.jsx src/components/profile/*.jsx` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/ProfilePage.jsx src/components/profile/ && git commit -m "refactor: retheme Profile page and components to color tokens"`

### Task 5: Retheme — Dashboard components

**Files:**
- Modify: `src/pages/DashboardPage.jsx`, `src/components/dashboard/BulletinWidget.jsx`, `src/components/dashboard/ImportantLinks.jsx`, `src/components/dashboard/MonthlyStatistics.jsx`, `src/components/dashboard/MyAbsences.jsx`, `src/components/dashboard/NewActivitiesBanner.jsx`, `src/components/dashboard/NextShiftCard.jsx`, `src/components/dashboard/QuizWidget.jsx`, `src/components/dashboard/UpcomingActivities.jsx`, `src/components/dashboard/WeatherWarnings.jsx`, `src/components/dashboard/ZalohaNotificationBanner.jsx`

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -noE "#[0-9a-fA-F]{3,6}" src/pages/DashboardPage.jsx src/components/dashboard/*.jsx` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/DashboardPage.jsx src/components/dashboard/ && git commit -m "refactor: retheme Dashboard to color tokens"`

### Task 6: Retheme — Admin pages, tabs, and modals

**Files:**
- Modify: `src/pages/AdminPage.jsx`, `src/pages/AdminQuizEditorPage.jsx`, `src/components/admin/BulletinTab.jsx`, `src/components/admin/DetailedInventoryTab.jsx`, `src/components/admin/EquipmentTypesTab.jsx`, `src/components/admin/LinksTab.jsx`, `src/components/admin/LogsTab.jsx`, `src/components/admin/QuizzesTab.jsx`, `src/components/admin/SuggestionsAdminTab.jsx`, `src/components/admin/UsersTab.jsx`, `src/components/admin/modals/CreateBulletinModal.jsx`, `src/components/admin/modals/CreateUserModal.jsx`, `src/components/admin/modals/EditMemberEquipmentModal.jsx`, `src/components/admin/modals/ReorderEquipmentTypesModal.jsx`, `src/components/admin/modals/ReorderLinksModal.jsx`, `src/components/admin/quizzes/QuestionEditor.jsx`, `src/components/admin/quizzes/QuestionStats.jsx`, `src/components/admin/quizzes/QuizAttemptDetail.jsx`, `src/components/admin/quizzes/QuizResultsTable.jsx`

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -rnoE "#[0-9a-fA-F]{3,6}" src/pages/AdminPage.jsx src/pages/AdminQuizEditorPage.jsx src/components/admin/` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/AdminPage.jsx src/pages/AdminQuizEditorPage.jsx src/components/admin/ && git commit -m "refactor: retheme Admin pages, tabs, and modals to color tokens"`

### Task 7: Retheme — Statistics

**Files:**
- Modify: `src/pages/StatisticsPage.jsx`, `src/components/statistics/AbsencesTab.jsx`, `src/components/statistics/ActivitiesTab.jsx`, `src/components/statistics/ChartComponents.jsx`, `src/components/statistics/LogStatsTab.jsx`, `src/components/statistics/ShiftsTab.jsx`, `src/components/statistics/StatCard.jsx`, `src/components/statistics/YearTab.jsx`

- [ ] Apply the Phase 2 process to each file above. Note: `ChartComponents.jsx` likely passes colors as Recharts `stroke`/`fill` props rather than CSS — these still accept `var(--token)` strings since Recharts renders plain SVG attributes, but verify visually that chart lines/bars remain visible against both light and dark backgrounds (don't use a near-white token for a bar fill, for instance).
- [ ] Verify: `grep -rnoE "#[0-9a-fA-F]{3,6}" src/pages/StatisticsPage.jsx src/components/statistics/` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/StatisticsPage.jsx src/components/statistics/ && git commit -m "refactor: retheme Statistics to color tokens"`

### Task 8: Retheme — Shifts (calendar page, row/chip components, modals)

**Files:**
- Modify: `src/pages/ShiftCalendarPage.jsx`, `src/components/shifts/AbsencePanel.jsx`, `src/components/shifts/InlineActivities.jsx`, `src/components/shifts/ShiftRow.jsx`, `src/components/shifts/SlotChip.jsx`, `src/components/shifts/modals/ActivityPopup.jsx`, `src/components/shifts/modals/AddAbsenceModal.jsx`, `src/components/shifts/modals/AddZalohaModal.jsx`, `src/components/shifts/modals/JoinShiftModal.jsx`, `src/components/shifts/modals/RetroAssignModal.jsx`, `src/components/shifts/modals/ZalohaAssignModal.jsx`

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -rnoE "#[0-9a-fA-F]{3,6}" src/pages/ShiftCalendarPage.jsx src/components/shifts/` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/ShiftCalendarPage.jsx src/components/shifts/ && git commit -m "refactor: retheme Shifts calendar and modals to color tokens"`

### Task 9: Retheme — Quizzes (take/protocol pages, quiz components)

**Files:**
- Modify: `src/pages/QuizProtocolPage.jsx`, `src/pages/QuizTakePage.jsx`, `src/components/quizzes/QuizCard.jsx`, `src/components/quizzes/QuizIntro.jsx`, `src/components/quizzes/QuizResultView.jsx`, `src/components/quizzes/QuizTimer.jsx`

- [ ] Apply the Phase 2 process to each file above. `QuizProtocolPage.jsx` is print-only (no navigation, per the existing comment in `App.jsx`) — leave its print-specific `@media print` colors as literal black/white if any exist (print output must stay black-on-white regardless of the viewer's theme); only convert its on-screen (non-print) colors.
- [ ] Verify: `grep -noE "#[0-9a-fA-F]{3,6}" src/pages/QuizProtocolPage.jsx src/pages/QuizTakePage.jsx src/components/quizzes/*.jsx` — review remaining matches are only inside `@media print` blocks.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/QuizProtocolPage.jsx src/pages/QuizTakePage.jsx src/components/quizzes/ && git commit -m "refactor: retheme quiz-taking pages and components to color tokens"`

### Task 10: Retheme — Logs (Maintenance/Cleaning)

**Files:**
- Modify: `src/pages/MaintenanceLogPage.jsx`, `src/pages/CleaningLogPage.jsx`, `src/components/logs/LogDayRow.jsx`, `src/components/logs/LogEntryEditor.jsx`, `src/components/logs/LogParticipantPicker.jsx`, `src/components/logs/MonthlyLogTable.jsx`

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -noE "#[0-9a-fA-F]{3,6}" src/pages/MaintenanceLogPage.jsx src/pages/CleaningLogPage.jsx src/components/logs/*.jsx` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/MaintenanceLogPage.jsx src/pages/CleaningLogPage.jsx src/components/logs/ && git commit -m "refactor: retheme Maintenance and Cleaning logs to color tokens"`

### Task 11: Retheme — Trainings and Events

**Files:**
- Modify: `src/pages/TrainingsPage.jsx`, `src/pages/EventsPage.jsx`, `src/components/trainings/CreateTrainingModal.jsx`, `src/components/trainings/TrainingCard.jsx`, `src/components/events/CreateEventModal.jsx`, `src/components/events/EventCard.jsx`

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -noE "#[0-9a-fA-F]{3,6}" src/pages/TrainingsPage.jsx src/pages/EventsPage.jsx src/components/trainings/*.jsx src/components/events/*.jsx` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/TrainingsPage.jsx src/pages/EventsPage.jsx src/components/trainings/ src/components/events/ && git commit -m "refactor: retheme Trainings and Events to color tokens"`

### Task 12: Retheme — Members, Suggestions, Auth, and shared components

**Files:**
- Modify: `src/pages/MembersPage.jsx`, `src/pages/SuggestionsPage.jsx`, `src/pages/AuthPage.jsx`, `src/components/members/MemberCard.jsx`, `src/components/suggestions/CreateSuggestionModal.jsx`, `src/components/suggestions/SuggestionCard.jsx`, `src/components/auth/ForcePasswordChange.jsx`, `src/components/AddressInput.jsx`, `src/components/ChangelogModal.jsx`, `src/components/Layout.jsx`, `src/components/LinkifiedText.jsx`, `src/components/UpdatePrompt.jsx`, `src/App.jsx` (the inline `<style>` in `PageLoader`)

- [ ] Apply the Phase 2 process to each file above.
- [ ] Verify: `grep -rnoE "#[0-9a-fA-F]{3,6}" src/pages/MembersPage.jsx src/pages/SuggestionsPage.jsx src/pages/AuthPage.jsx src/components/members/ src/components/suggestions/ src/components/auth/ src/App.jsx` returns nothing, and `grep -noE "#[0-9a-fA-F]{3,6}" src/components/AddressInput.jsx src/components/ChangelogModal.jsx src/components/Layout.jsx src/components/LinkifiedText.jsx src/components/UpdatePrompt.jsx` returns nothing.
- [ ] Run `npm run build && npm run lint`.
- [ ] Commit: `git add src/pages/MembersPage.jsx src/pages/SuggestionsPage.jsx src/pages/AuthPage.jsx src/components/members/ src/components/suggestions/ src/components/auth/ src/components/AddressInput.jsx src/components/ChangelogModal.jsx src/components/Layout.jsx src/components/LinkifiedText.jsx src/components/UpdatePrompt.jsx src/App.jsx && git commit -m "refactor: retheme Members, Suggestions, Auth, and shared components to color tokens"`

### Task 13: Retheme sweep — confirm zero hardcoded colors remain

**Files:**
- Modify: none expected (verification-only task; fix any stragglers found)

- [ ] **Step 1: Run the full-repo check**

Run: `grep -rlE "#[0-9a-fA-F]{3,6}" src --include=*.jsx`
Expected: empty output, OR only files whose remaining matches are inside `@media print` blocks (from Task 9's `QuizProtocolPage.jsx` exception).

- [ ] **Step 2: If anything unexpected remains, fix it inline using the Phase 2 process, then re-run Step 1.**

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "refactor: fix remaining hardcoded colors found in retheme sweep"
```

(Skip this commit if Step 1 was already clean.)

---

## Phase 3: Settings UI + theme/landing-page controls

### Task 14: `SettingsSection.jsx` — Vzhled (theme) and Úvodní stránka (landing page) subsections

**Files:**
- Create: `src/components/profile/SettingsSection.jsx`
- Modify: `src/pages/ProfilePage.jsx` (render the new section)
- Modify: `src/pages/TrainingsPage.jsx` (add the anchor target)

**Interfaces:**
- Consumes: `useAuth()` for `currentUser`/`userData` (existing pattern from `src/hooks/useProfile.js:9`); `getTheme`, `getLandingPage` from `shared/preferences.js` (Task 1)
- Produces: `SettingsSection` component (no props — reads `useAuth()` directly, matching how `QuizHistory` is self-contained per `src/pages/ProfilePage.jsx:370`)

- [ ] **Step 1: Add the `id` anchor to `src/pages/TrainingsPage.jsx`**

Find the container `div`/section that wraps the "Kvízy" heading (identified earlier at `src/pages/TrainingsPage.jsx:182`, the `<span>Kvízy</span>` inside a section header) and add `id="kvizy-sekce"` to its enclosing section wrapper element — read the surrounding ~20 lines first to find the correct wrapping element (likely a `section-header`/`section-body` pair per the pattern established in `src/index.css:768-844`), then add the id to the outer wrapper of that pair so `scrollIntoView` lands on the whole Kvízy block, not just its heading.

- [ ] **Step 2: Create `src/components/profile/SettingsSection.jsx` (theme + landing page parts only for this task)**

```jsx
import React from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { getTheme, getLandingPage } from '../../../shared/preferences.js';

const THEME_OPTIONS = [
    { value: 'light', label: 'Světlé' },
    { value: 'dark', label: 'Tmavé' },
    { value: 'system', label: 'Podle systému' },
];

const LANDING_PAGE_OPTIONS = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'sluzby', label: 'Služby' },
    { value: 'skoleni', label: 'Školení' },
    { value: 'kvizy', label: 'Kvízy' },
];

export default function SettingsSection() {
    const { currentUser, userData } = useAuth();
    const preferences = userData?.preferences;

    async function updatePreference(key, value) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { [`preferences.${key}`]: value });
    }

    return (
        <div className="card">
            <h3 style={{ marginTop: 0 }}>Nastavení</h3>

            <div style={{ marginBottom: '1.5rem' }}>
                <div className="input-label">Vzhled</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {THEME_OPTIONS.map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="theme"
                                value={opt.value}
                                checked={getTheme(preferences) === opt.value}
                                onChange={() => updatePreference('theme', opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <div className="input-label">Úvodní stránka</div>
                <select
                    className="select-field"
                    value={getLandingPage(preferences)}
                    onChange={(e) => updatePreference('landingPage', e.target.value)}
                >
                    {LANDING_PAGE_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
```

`updateDoc` with a dotted key path (`'preferences.theme'`) updates only that sub-field, so it never clobbers `dashboardWidgets`/`pushCategories` written by later tasks — this is standard Firestore field-path update behavior, already relied on nowhere else in this codebase but is documented Firestore SDK behavior.

- [ ] **Step 3: Render it in `src/pages/ProfilePage.jsx`**

Add the import next to the other profile component imports:

```js
import SettingsSection from '../components/profile/SettingsSection';
```

Add `<SettingsSection />` after `<QuizHistory />` inside the column at `src/pages/ProfilePage.jsx:370` (same flex column as `EquipmentSection`/`QuizHistory`):

```jsx
                    <EquipmentSection ... />
                    <QuizHistory />
                    <SettingsSection />
```

- [ ] **Step 4: Manually verify**

Run `npm run dev`, open Profil, confirm a new "Nastavení" card renders below quiz history with theme radios and a landing-page dropdown. Switch theme to "Tmavé" — confirm `document.documentElement`'s `data-theme` becomes `dark` and the page visibly re-colors (Phase 2 retheme must be complete for this to look correct everywhere). Reload the page — theme selection persists (read back from Firestore via `AuthContext`).

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/SettingsSection.jsx src/pages/ProfilePage.jsx src/pages/TrainingsPage.jsx
git commit -m "feat: add theme and landing-page controls to profile settings"
```

---

### Task 15: Landing-page redirect on Dashboard

**Files:**
- Modify: `src/pages/DashboardPage.jsx`

**Interfaces:**
- Consumes: `getLandingPage(preferences)` from `shared/preferences.js` (Task 1); `useNavigate` (already imported at `src/pages/DashboardPage.jsx:2`)

- [ ] **Step 1: Add the redirect effect**

In `src/pages/DashboardPage.jsx`, add the import:

```js
import { useEffect } from 'react';
import { getLandingPage } from '../../shared/preferences.js';
```

(`React` is already imported per line 1; add `useEffect` to that same import statement rather than a separate one.)

Inside `DashboardPage`, after the existing `useDashboardData()` destructure (`src/pages/DashboardPage.jsx:17-25`), add:

```jsx
    useEffect(() => {
        const landing = getLandingPage(userData?.preferences);
        if (landing === 'dashboard') return;
        if (landing === 'sluzby') navigate('/shifts', { replace: true });
        else if (landing === 'skoleni') navigate('/skoleni', { replace: true });
        else if (landing === 'kvizy') navigate('/skoleni', { replace: true, state: { scrollTo: 'kvizy-sekce' } });
    }, [userData?.preferences, navigate]);
```

- [ ] **Step 2: Handle the scroll-to-anchor on `TrainingsPage`**

In `src/pages/TrainingsPage.jsx`, add:

```js
import { useLocation } from 'react-router-dom';
```

Inside the `TrainingsPage` component body, add:

```jsx
    const location = useLocation();
    useEffect(() => {
        if (location.state?.scrollTo) {
            document.getElementById(location.state.scrollTo)?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [location.state]);
```

(If `TrainingsPage.jsx` doesn't already import `useEffect`, add it to its React import statement.)

- [ ] **Step 3: Manually verify**

Set landing page to "Kvízy" in Nastavení, reload the app at `/`. Confirm it redirects to `/skoleni` and scrolls to the Kvízy section. Set it to "Dashboard" and confirm reload stays on `/` with no redirect loop.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.jsx src/pages/TrainingsPage.jsx
git commit -m "feat: redirect to preferred landing page after login"
```

---

## Phase 4: Dashboard widget picker

### Task 16: Configurable widget order/visibility on Dashboard

**Files:**
- Modify: `src/pages/DashboardPage.jsx`

**Interfaces:**
- Consumes: `getDashboardWidgetOrder(preferences, allWidgetIds)` from `shared/preferences.js` (Task 1); `DEFAULT_DASHBOARD_WIDGET_ORDER` (same file, for the `allWidgetIds` argument)

- [ ] **Step 1: Extract the widget config**

In `src/pages/DashboardPage.jsx`, add near the top (after imports):

```jsx
import { getDashboardWidgetOrder, DEFAULT_DASHBOARD_WIDGET_ORDER } from '../../shared/preferences.js';

const WIDGET_COMPONENTS = {
    bulletin: BulletinWidget,
    nextShift: (props) => <NextShiftCard allShifts={props.allShifts} userData={props.userData} />,
    quiz: QuizWidget,
    monthlyStats: (props) => <MonthlyStatistics monthlyStats={props.monthlyStats} />,
    upcomingActivities: (props) => <UpcomingActivities upcomingActivities={props.upcomingActivities} />,
    myAbsences: (props) => <MyAbsences absences={props.absences} />,
    importantLinks: ImportantLinks,
};
```

- [ ] **Step 2: Replace the fixed widget JSX with a mapped render**

Replace the block from `{/* Bulletin Board Widget */}` through `<MyAbsences absences={absences} />` (`src/pages/DashboardPage.jsx:84-103`) with:

```jsx
            {getDashboardWidgetOrder(userData?.preferences, DEFAULT_DASHBOARD_WIDGET_ORDER).map((widgetId) => {
                const Widget = WIDGET_COMPONENTS[widgetId];
                if (!Widget) return null;
                return <Widget key={widgetId} allShifts={allShifts} userData={userData} monthlyStats={monthlyStats} upcomingActivities={upcomingActivities} absences={absences} />;
            })}
```

The banners above this block (`WeatherWarnings`, `ZalohaNotificationBanner`, `NewActivitiesBanner`) stay untouched — they render unconditionally, outside this mapped list, per the Global Constraints.

- [ ] **Step 3: Manually verify**

Run `npm run dev`. Dashboard should render identically to before (default order, nothing hidden). Manually set, via the Firestore console or temporarily via browser devtools, `preferences.dashboardWidgets = { order: ['quiz', 'bulletin'], hidden: ['myAbsences'] }` on your own user doc — reload and confirm the quiz widget now renders first, bulletin second, and no other widgets, and `myAbsences` doesn't render.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.jsx
git commit -m "feat: make dashboard widget order and visibility configurable"
```

---

### Task 17: Nástěnka subsection in Settings — show/hide + reorder UI

**Files:**
- Modify: `src/components/profile/SettingsSection.jsx`

**Interfaces:**
- Consumes: `getDashboardWidgetOrder`, `DEFAULT_DASHBOARD_WIDGET_ORDER` from `shared/preferences.js`

- [ ] **Step 1: Add a widget labels map and the subsection**

In `src/components/profile/SettingsSection.jsx`, add:

```jsx
import { getTheme, getLandingPage, getDashboardWidgetOrder, DEFAULT_DASHBOARD_WIDGET_ORDER } from '../../../shared/preferences.js';

const WIDGET_LABELS = {
    bulletin: 'Nástěnka',
    nextShift: 'Nejbližší služba',
    quiz: 'Nesplněné kvízy',
    monthlyStats: 'Měsíční statistiky',
    upcomingActivities: 'Nadcházející aktivity',
    myAbsences: 'Moje absence',
    importantLinks: 'Důležité odkazy',
};
```

Add a `moveWidget` helper and the subsection markup inside `SettingsSection`, after the "Úvodní stránka" block:

```jsx
    const visibleOrder = getDashboardWidgetOrder(preferences, DEFAULT_DASHBOARD_WIDGET_ORDER);
    const hidden = preferences?.dashboardWidgets?.hidden || [];
    const fullOrder = preferences?.dashboardWidgets?.order || DEFAULT_DASHBOARD_WIDGET_ORDER;

    async function toggleWidget(widgetId) {
        const nextHidden = hidden.includes(widgetId)
            ? hidden.filter(id => id !== widgetId)
            : [...hidden, widgetId];
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            'preferences.dashboardWidgets': { order: fullOrder, hidden: nextHidden },
        });
    }

    async function moveWidget(widgetId, direction) {
        const idx = fullOrder.indexOf(widgetId);
        const swapWith = idx + direction;
        if (idx === -1 || swapWith < 0 || swapWith >= fullOrder.length) return;
        const nextOrder = [...fullOrder];
        [nextOrder[idx], nextOrder[swapWith]] = [nextOrder[swapWith], nextOrder[idx]];
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            'preferences.dashboardWidgets': { order: nextOrder, hidden },
        });
    }
```

```jsx
            <div style={{ marginTop: '1.5rem' }}>
                <div className="input-label">Nástěnka</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {fullOrder.map((widgetId, idx) => (
                        <div key={widgetId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <input
                                type="checkbox"
                                checked={!hidden.includes(widgetId)}
                                onChange={() => toggleWidget(widgetId)}
                            />
                            <span style={{ flex: 1 }}>{WIDGET_LABELS[widgetId] || widgetId}</span>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }}
                                disabled={idx === 0} onClick={() => moveWidget(widgetId, -1)}>↑</button>
                            <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }}
                                disabled={idx === fullOrder.length - 1} onClick={() => moveWidget(widgetId, 1)}>↓</button>
                        </div>
                    ))}
                </div>
            </div>
```

(`visibleOrder` is computed but unused directly in the UI — it exists so a future consumer of this component can preview the resulting visible list; remove it if lint flags it as unused, keeping only `fullOrder`/`hidden`.)

- [ ] **Step 2: Run lint to catch the unused-variable case from the note above**

Run: `npm run lint`
Expected: if `visibleOrder` is flagged unused, delete that line — it was a preview aid, not required by the toggle/move logic which reads `fullOrder`/`hidden` directly.

- [ ] **Step 3: Manually verify**

In Nastavení, uncheck "Moje absence" — confirm it disappears from Dashboard on next visit. Click ↓ next to "Nástěnka" — confirm it swaps position with the widget below, and Dashboard reflects the new order.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile/SettingsSection.jsx
git commit -m "feat: add dashboard widget show/hide and reorder controls to settings"
```

---

## Phase 5: Push notification categories

### Task 18: `sendPushNotification` shared client helper

**Files:**
- Create: `src/utils/pushNotification.js`

**Interfaces:**
- Produces: `sendPushNotification({ title, body, url, tag, category, targetUserId, targetUserIds, targetRoles })` → `Promise<void>` — thin wrapper around the existing `fetch('/api/send-notification', ...)` call pattern already duplicated across `useShiftCalendar.js`, `useQuizzes.js`, `CreateTrainingModal.jsx`, `CreateEventModal.jsx`.

- [ ] **Step 1: Create the helper**

```js
// src/utils/pushNotification.js
//
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
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/pushNotification.js
git commit -m "feat: add shared sendPushNotification client helper"
```

---

### Task 19: Route quiz and shift push sends through the shared helper with categories

**Files:**
- Modify: `src/hooks/useQuizzes.js:33-46` (the `sendQuizNotification` export)
- Modify: `src/hooks/useShiftCalendar.js` (6 inline `fetch('/api/send-notification', ...)` call sites found at lines 532, 602, 811, 931, 945, 1013)

**Interfaces:**
- Consumes: `sendPushNotification` from `src/utils/pushNotification.js` (Task 18)

- [ ] **Step 1: Update `useQuizzes.js`'s `sendQuizNotification` to delegate**

Replace the body of `sendQuizNotification` (`src/hooks/useQuizzes.js:33-46`) — keep the exported function name and signature unchanged since `useQuizResults.js` imports it, per the existing comment at line 30-32:

```js
import { sendPushNotification } from '../utils/pushNotification';

export async function sendQuizNotification({ title, body, url = '/skoleni', tag, targetRoles, targetUserIds }) {
    await sendPushNotification({ title, body, url, tag, category: 'kvizy', targetRoles, targetUserIds });
}
```

- [ ] **Step 2: Replace each of the 6 inline `fetch` calls in `useShiftCalendar.js` with `sendPushNotification`**

Add the import at the top of `src/hooks/useShiftCalendar.js`:

```js
import { sendPushNotification } from '../utils/pushNotification';
```

For each of the 6 call sites, replace the `fetch('/api/send-notification', { method: 'POST', headers: {...}, body: JSON.stringify({...}) })` pattern with `sendPushNotification({...})` using the same field values already present in each site's `body: JSON.stringify({...})` object, adding `category: 'sluzby'` to every one. For example, the site at line 532-542 becomes:

```js
        sendPushNotification({
            title: `✋ Nový zájemce o ${kind.accusative}`,
            body: `${userData.lastName} ${userData.firstName ? userData.firstName[0] + '.' : ''} · ${dateLabel}`,
            url: '/shifts',
            tag: 'staz-zajem',
            category: 'sluzby',
            targetRoles: ['Admin', 'VJ', 'Zástupce VJ'],
        });
```

Repeat the same mechanical transform (drop the `fetch`/`method`/`headers`/`JSON.stringify` wrapper, call `sendPushNotification` directly with the same field values plus `category: 'sluzby'`) for the remaining 5 sites (lines ~602, ~811, ~931, ~945, ~1013 in the pre-edit file — re-locate them with `grep -n "fetch('/api/send-notification'" src/hooks/useShiftCalendar.js` since line numbers shift after the first edit).

- [ ] **Step 3: Verify no direct `fetch('/api/send-notification'` calls remain in either file**

Run: `grep -n "fetch('/api/send-notification'" src/hooks/useQuizzes.js src/hooks/useShiftCalendar.js`
Expected: no output.

- [ ] **Step 4: Run build and lint**

Run: `npm run build && npm run lint`
Expected: both pass.

- [ ] **Step 5: Manually verify**

Trigger a shift-related notification-generating action in the dev app (e.g. join a záloha slot as a non-admin, which is the `staz-zajem` site) and confirm (via Network tab) the POST body to `/api/send-notification` now includes `"category":"sluzby"`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useQuizzes.js src/hooks/useShiftCalendar.js
git commit -m "refactor: route quiz and shift push notifications through shared helper with categories"
```

---

### Task 20: Route training and event push sends through the shared helper with categories

**Files:**
- Modify: `src/components/trainings/CreateTrainingModal.jsx:136-...` (the `fetch('/api/send-notification', ...)` call site)
- Modify: `src/components/events/CreateEventModal.jsx:88-...` (the `fetch('/api/send-notification', ...)` call site)

**Interfaces:**
- Consumes: `sendPushNotification` from `src/utils/pushNotification.js` (Task 18)

- [ ] **Step 1: Update `CreateTrainingModal.jsx`**

Add the import:

```js
import { sendPushNotification } from '../../utils/pushNotification';
```

Replace the `fetch('/api/send-notification', { method: 'POST', headers: {...}, body: JSON.stringify({...}) })` block starting at `src/components/trainings/CreateTrainingModal.jsx:136` with `sendPushNotification({ ...same fields as the existing body..., category: 'skoleni' })`, preserving every existing field value (title, body text, url, tag/targetRoles/targetUserIds if present) — only the wrapper changes, plus the added `category`.

- [ ] **Step 2: Update `CreateEventModal.jsx`**

Same transform, `category: 'akce'`, importing `sendPushNotification` from `'../../utils/pushNotification'` and replacing the block at `src/components/events/CreateEventModal.jsx:88`.

- [ ] **Step 3: Verify no direct `fetch('/api/send-notification'` calls remain**

Run: `grep -rn "fetch('/api/send-notification'" src/`
Expected: no output anywhere in `src/`.

- [ ] **Step 4: Run build and lint**

Run: `npm run build && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add src/components/trainings/CreateTrainingModal.jsx src/components/events/CreateEventModal.jsx
git commit -m "refactor: route training and event push notifications through shared helper with categories"
```

---

### Task 21: Server-side category filtering in `api/send-notification.js`

**Files:**
- Modify: `api/send-notification.js`

**Interfaces:**
- Consumes: `shouldReceivePush(preferences, category)` from `shared/preferences.js` (Task 1) — Node ESM import, same pattern already used by `api/quiz-reminders.js:4-9` (`import { ... } from '../shared/quizStatus.js'`)

- [ ] **Step 1: Add the import and filter step**

In `api/send-notification.js`, add the import and extend the existing `firebase-admin/firestore` import to also pull `FieldPath` (needed for the document-ID `in` query in Step below):

```js
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { shouldReceivePush } from '../shared/preferences.js';
```

(This replaces the existing `import { getFirestore } from 'firebase-admin/firestore';` line — same import, one extra named export.)

Replace the destructure and the recipient-resolution block (`api/send-notification.js:26-45`) to also accept `category` and filter by it:

```js
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
```

The rest of the function (the `Promise.allSettled` send loop and the response) is unchanged.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: passes (this file isn't part of the Vite build but a syntax check via `node --check api/send-notification.js` is a faster local sanity check — run that too: `node --check api/send-notification.js`).

- [ ] **Step 3: Manually verify against the deployed/dev environment**

Per the README, `api/` doesn't run under `npm run dev` — verify this on a Vercel preview deploy (or `vercel dev`): disable the "Služby" push category for your own account in Nastavení, trigger a shift-related notification, and confirm (server logs or absence of the push arriving) you no longer receive it while another category still does.

- [ ] **Step 4: Commit**

```bash
git add api/send-notification.js
git commit -m "feat: filter push notification recipients by their category preference"
```

---

### Task 22: Server-side category filtering in `api/quiz-reminders.js`

**Files:**
- Modify: `api/quiz-reminders.js`

**Interfaces:**
- Consumes: `shouldReceivePush(preferences, category)` from `shared/preferences.js` (Task 1)

This cron sends push directly via `webpush.sendNotification` (`api/quiz-reminders.js:142`) rather than going through `api/send-notification.js`, so it needs its own filter — it does not benefit from Task 21's change.

- [ ] **Step 1: Add the import**

```js
import { shouldReceivePush } from '../shared/preferences.js';
```

- [ ] **Step 2: Filter `targetUserIds` by the `kvizy` category**

In the per-quiz loop, `targetUserIds` is computed at `api/quiz-reminders.js:110-113`. Add one more `.filter(...)` to that chain:

```js
            const targetUserIds = members
                .filter(member => isAssignedTo(quiz, member, training))
                .filter(member => deriveMemberStatus(attemptsByUid.get(member.uid) || []) !== MEMBER_STATUS.PASSED)
                .filter(member => shouldReceivePush(member.preferences, 'kvizy'))
                .map(member => member.uid);
```

`members` already carries the full user doc (`members = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))` at line 83), so `member.preferences` is available with no extra Firestore read.

- [ ] **Step 3: Run a syntax check**

Run: `node --check api/quiz-reminders.js`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add api/quiz-reminders.js
git commit -m "feat: exclude members who disabled quiz push notifications from reminders"
```

---

### Task 23: Oznámení subsection in Settings — push category toggles

**Files:**
- Modify: `src/components/profile/SettingsSection.jsx`

**Interfaces:**
- Consumes: `shouldReceivePush` from `shared/preferences.js` (Task 1)

- [ ] **Step 1: Add push-permission detection and the subsection**

In `src/components/profile/SettingsSection.jsx`, add:

```jsx
import { getTheme, getLandingPage, getDashboardWidgetOrder, DEFAULT_DASHBOARD_WIDGET_ORDER, shouldReceivePush } from '../../../shared/preferences.js';

const PUSH_CATEGORY_OPTIONS = [
    { value: 'kvizy', label: 'Kvízy' },
    { value: 'sluzby', label: 'Služby' },
    { value: 'skoleni', label: 'Školení' },
    { value: 'akce', label: 'Akce' },
];
```

Inside `SettingsSection`, add a state read for the browser's current push permission (no new subscription logic — this only reads, `usePushNotifications.js` already owns subscribing):

```jsx
    const pushPermissionGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

    async function togglePushCategory(category) {
        const current = shouldReceivePush(preferences, category);
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { [`preferences.pushCategories.${category}`]: !current });
    }
```

Add the subsection markup after the Nástěnka block:

```jsx
            <div style={{ marginTop: '1.5rem' }}>
                <div className="input-label">Oznámení</div>
                {!pushPermissionGranted && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>
                        Push notifikace nejsou v tomto prohlížeči povoleny — nastavení níže se uplatní až po jejich povolení.
                    </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {PUSH_CATEGORY_OPTIONS.map(opt => (
                        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', opacity: pushPermissionGranted ? 1 : 0.5 }}>
                            <input
                                type="checkbox"
                                disabled={!pushPermissionGranted}
                                checked={shouldReceivePush(preferences, opt.value)}
                                onChange={() => togglePushCategory(opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </div>
            </div>
```

- [ ] **Step 2: Manually verify**

In a browser with push permission granted, open Nastavení, uncheck "Služby". Confirm (Firestore console) `preferences.pushCategories.sluzby` becomes `false`. In a browser/profile without push permission granted, confirm the 4 checkboxes render disabled with the explanatory hint shown.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/SettingsSection.jsx
git commit -m "feat: add push notification category toggles to profile settings"
```

---

## Final verification

- [ ] **Full test suite:** `npm test` — expect all `shared/**/*.test.js` (including the new `preferences.test.js`) to pass.
- [ ] **Lint:** `npm run lint` — expect zero violations.
- [ ] **Build:** `npm run build` — expect success.
- [ ] **Full retheme check:** `grep -rlE "#[0-9a-fA-F]{3,6}" src --include=*.jsx` — expect empty, or only `QuizProtocolPage.jsx` with matches confined to `@media print` blocks.
- [ ] **Manual smoke test** (`npm run dev`, plus a Vercel preview for the `api/` pieces): toggle dark mode and click through every nav item to confirm no light-on-light or dark-on-dark unreadable text; change landing page and confirm redirect; hide/reorder dashboard widgets and confirm Dashboard reflects it; toggle a push category off and confirm (via Network tab on a triggered action) the server excludes that recipient.
