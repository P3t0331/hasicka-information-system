# Dostupnost k výjezdu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members mark when they are available (and how fast they reach the station); the dashboard shows for the next 14 days whether a crew of 2× Hasič, 1× Strojník, 1× Velitel is covered, and Statistiky shows monthly coverage.

**Architecture:** All rules (slot validation/merging, crew assignment, day status, month summary, log texts, week copy) live in one pure module `shared/availability.js`, tested with Vitest. A hook `src/hooks/useAvailability.js` loads Firestore data (`availability`, `absences/global`, `shifts/{YYYY-MM}`, approved `users`) and performs writes + logging. UI: a fixed `AvailabilityCard` on the dashboard and an `AvailabilityTab` in Statistiky, both rendering the same `DayPanel`.

**Tech Stack:** React 19, Firebase Firestore (web SDK v12), Vitest 4 (`environment: node`, only `shared/**/*.test.js` + `api/**/*.test.js`), Recharts 3.

**Spec:** `docs/superpowers/specs/2026-09-13-dostupnost-design.md`

## Global Constraints

- Crew requirement: 1× Velitel (VD, Zástupce VJ, `Zastupce VJ`, VJ), 1× Strojník (Strojník), 2× Hasič (Hasič, Strojník, VD, Zástupce VJ, `Zastupce VJ`, VJ). `Admin` / `Přístup do Administrace` alone do not count. Each person fills at most one position.
- Day window 05:00–18:00. Max 3 slots per day. `travelMin` whole number 1–180. Travel presets: 1, 2, 5, 10, 15, 20, 30.
- Firestore doc: `availability/{YYYY-MM-DD}_{uid}` = `{ uid, date, slots: [{ from, to, travelMin }], updatedAt }`.
- Remembered travel: `users/{uid}.preferences.availabilityTravelMin`.
- Dashboard window: today + 13 days (14 tiles). Past days are never editable.
- Card title **Dostupnost k výjezdu**, subtitle `2× Hasič · 1× Strojník · 1× Velitel`. UI must not mention DN.
- Log category `availability` (label Dostupnost, icon 🚑, colours `--indigo-deep` / `--indigo-bg` / `--indigo`). Actions `AVAILABILITY_ADDED`, `AVAILABILITY_UPDATED`, `AVAILABILITY_REMOVED`, `AVAILABILITY_COPIED_WEEK`. Logging is fire-and-forget via `logAction`.
- Only theme tokens (`var(--…)`) for colours — no literal hex/rgba in new components.
- Members are users with `approved === true` and not `disabled`; uid = Firestore doc id. Legacy users may have `role` (string) instead of `roles` (array) — treat as `[role || 'Hasič']`.
- Absences live in `absences/global` → `items: [{ uid, startDate, endDate, reason, userName }]` (ISO dates, inclusive).
- Shifts live in `shifts/{YYYY-MM}` → `days[dayNumber].dayShift = { slotKey: { uid, name, timeFrom?, timeTo?, fromHome? } }`.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Do not bump `APP_VERSION` (only on explicit release instruction).

## File Structure

| File | Responsibility |
|---|---|
| `shared/availability.js` (create) | Constants, date/time helpers, slot validation + normalisation, crew coverage per day, month summary, week-copy plan, display + log texts |
| `shared/availability.test.js` (create) | Vitest for everything above |
| `src/components/admin/constants.js` (modify) | Log category + action labels |
| `firestore.rules` (modify) | Exclude `availability` from catch-all, add validated block |
| `src/hooks/useAvailability.js` (create) | `useAvailabilityData(startISO, endISO)` listeners; `useAvailabilityActions()` writes + logs + toasts |
| `src/components/dashboard/availability/statusStyle.js` (create) | Status → token colours |
| `src/components/dashboard/availability/DayStrip.jsx` (create) | 14 day tiles |
| `src/components/dashboard/availability/TravelPicker.jsx` (create) | First-use "Za jak dlouho jsi na stanici?" picker |
| `src/components/dashboard/availability/SlotEditor.jsx` (create) | Edit up to 3 slots with travel time |
| `src/components/dashboard/availability/DayPanel.jsx` (create) | Selected day: status, my actions, people list (also read-only for stats) |
| `src/components/dashboard/availability/AvailabilityCard.jsx` (create) | Dashboard container |
| `src/pages/DashboardPage.jsx` (modify) | Render the card under the header |
| `src/components/statistics/AvailabilityTab.jsx` (create) | Monthly stats tab |
| `src/pages/StatisticsPage.jsx` (modify) | Tab button + render |
| `README.md` (modify) | Docs (changelog text is prepared in the final summary, not committed — see Task 8) |

---

### Task 1: Shared basics — constants, dates, times, slot validation and normalisation

**Files:**
- Create: `shared/availability.js`
- Test: `shared/availability.test.js`

**Interfaces:**
- Produces (exact exports used by later tasks):
  - `DAY_START = '05:00'`, `DAY_END = '18:00'`, `MAX_SLOTS = 3`, `MIN_TRAVEL = 1`, `MAX_TRAVEL = 180`, `TRAVEL_PRESETS = [1,2,5,10,15,20,30]`, `WINDOW_DAYS = 14`
  - `toMinutes(hhmm: string): number`, `fromMinutes(min: number): string`
  - `toISODate(date: Date): string` (local date), `addDays(iso: string, n: number): string`, `monthDocIdsBetween(startISO, endISO): string[]`, `formatDateCZ(iso: string, withYear = true): string`, `availabilityDocId(date, uid): string`
  - `validateSlots(slots): string | null` (Czech error message or null)
  - `normalizeSlots(slots): Slot[]` (sorted, same-travel overlaps/touches merged; assumes valid input)
  - `slotsEqual(a: Slot[], b: Slot[]): boolean`
  - `Slot = { from: 'HH:MM', to: 'HH:MM', travelMin: number }`

- [ ] **Step 1: Write the failing tests**

Create `shared/availability.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  toMinutes,
  fromMinutes,
  toISODate,
  addDays,
  monthDocIdsBetween,
  formatDateCZ,
  availabilityDocId,
  validateSlots,
  normalizeSlots,
  slotsEqual,
} from './availability.js';

describe('časy a data', () => {
  it('převádí HH:MM na minuty a zpět', () => {
    expect(toMinutes('05:30')).toBe(330);
    expect(fromMinutes(330)).toBe('05:30');
    expect(fromMinutes(18 * 60)).toBe('18:00');
  });

  it('toISODate používá místní datum', () => {
    expect(toISODate(new Date(2026, 8, 5, 23, 59))).toBe('2026-09-05');
  });

  it('addDays přechází přes konec měsíce', () => {
    expect(addDays('2026-09-28', 7)).toBe('2026-10-05');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('monthDocIdsBetween vrací všechny zasažené měsíce', () => {
    expect(monthDocIdsBetween('2026-09-25', '2026-10-08')).toEqual(['2026-09', '2026-10']);
    expect(monthDocIdsBetween('2026-09-01', '2026-09-30')).toEqual(['2026-09']);
  });

  it('formatDateCZ', () => {
    expect(formatDateCZ('2026-09-05')).toBe('5. 9. 2026');
    expect(formatDateCZ('2026-09-05', false)).toBe('5. 9.');
  });

  it('availabilityDocId', () => {
    expect(availabilityDocId('2026-09-15', 'abc')).toBe('2026-09-15_abc');
  });
});

describe('validateSlots', () => {
  const ok = { from: '05:00', to: '18:00', travelMin: 5 };

  it('platný celý den', () => {
    expect(validateSlots([ok])).toBeNull();
  });

  it('prázdný seznam', () => {
    expect(validateSlots([])).toBe('Přidejte alespoň jeden čas.');
  });

  it('více než 3 úseky', () => {
    const s = [
      { from: '05:00', to: '06:00', travelMin: 5 },
      { from: '07:00', to: '08:00', travelMin: 5 },
      { from: '09:00', to: '10:00', travelMin: 5 },
      { from: '11:00', to: '12:00', travelMin: 5 },
    ];
    expect(validateSlots(s)).toBe('Nejvýše 3 časové úseky.');
  });

  it('nevyplněný čas', () => {
    expect(validateSlots([{ ...ok, to: '' }])).toBe('Vyplňte čas od a do.');
  });

  it('mimo 05:00–18:00', () => {
    expect(validateSlots([{ ...ok, from: '04:59' }])).toBe('Čas musí být mezi 05:00 a 18:00.');
    expect(validateSlots([{ ...ok, to: '18:01' }])).toBe('Čas musí být mezi 05:00 a 18:00.');
  });

  it('od >= do', () => {
    expect(validateSlots([{ ...ok, from: '10:00', to: '10:00' }])).toBe('Čas „do“ musí být po čase „od“.');
  });

  it('dojezd mimo 1–180 nebo neceločíselný', () => {
    const msg = 'Dojezd musí být 1–180 minut.';
    expect(validateSlots([{ ...ok, travelMin: 0 }])).toBe(msg);
    expect(validateSlots([{ ...ok, travelMin: 181 }])).toBe(msg);
    expect(validateSlots([{ ...ok, travelMin: 2.5 }])).toBe(msg);
    expect(validateSlots([{ ...ok, travelMin: NaN }])).toBe(msg);
  });

  it('překryv s různým dojezdem je chyba', () => {
    expect(validateSlots([
      { from: '05:00', to: '10:00', travelMin: 15 },
      { from: '09:00', to: '12:00', travelMin: 2 },
    ])).toBe('Časy se překrývají.');
  });

  it('překryv se stejným dojezdem je v pořádku', () => {
    expect(validateSlots([
      { from: '05:00', to: '10:00', travelMin: 5 },
      { from: '09:00', to: '12:00', travelMin: 5 },
    ])).toBeNull();
  });

  it('dotýkající se úseky s různým dojezdem jsou v pořádku', () => {
    expect(validateSlots([
      { from: '05:00', to: '10:00', travelMin: 15 },
      { from: '10:00', to: '18:00', travelMin: 2 },
    ])).toBeNull();
  });
});

describe('normalizeSlots', () => {
  it('seřadí úseky', () => {
    expect(normalizeSlots([
      { from: '13:00', to: '18:00', travelMin: 2 },
      { from: '05:00', to: '10:00', travelMin: 15 },
    ])).toEqual([
      { from: '05:00', to: '10:00', travelMin: 15 },
      { from: '13:00', to: '18:00', travelMin: 2 },
    ]);
  });

  it('sloučí překryv i dotyk se stejným dojezdem', () => {
    expect(normalizeSlots([
      { from: '09:00', to: '12:00', travelMin: 5 },
      { from: '05:00', to: '10:00', travelMin: 5 },
      { from: '12:00', to: '14:00', travelMin: 5 },
    ])).toEqual([{ from: '05:00', to: '14:00', travelMin: 5 }]);
  });

  it('dotýkající se úseky s různým dojezdem nechá oddělené', () => {
    expect(normalizeSlots([
      { from: '10:00', to: '18:00', travelMin: 2 },
      { from: '05:00', to: '10:00', travelMin: 15 },
    ])).toEqual([
      { from: '05:00', to: '10:00', travelMin: 15 },
      { from: '10:00', to: '18:00', travelMin: 2 },
    ]);
  });

  it('odstraní cizí pole a nemění vstup', () => {
    const input = [{ from: '05:00', to: '18:00', travelMin: 5, custom: true }];
    expect(normalizeSlots(input)).toEqual([{ from: '05:00', to: '18:00', travelMin: 5 }]);
    expect(input[0].custom).toBe(true);
  });
});

describe('slotsEqual', () => {
  it('porovná obsah po normalizaci', () => {
    const a = [{ from: '13:00', to: '18:00', travelMin: 2 }, { from: '05:00', to: '10:00', travelMin: 15 }];
    const b = [{ from: '05:00', to: '10:00', travelMin: 15 }, { from: '13:00', to: '18:00', travelMin: 2 }];
    expect(slotsEqual(a, b)).toBe(true);
    expect(slotsEqual(a, [{ from: '05:00', to: '18:00', travelMin: 2 }])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/availability.test.js`
Expected: FAIL — `Failed to resolve import "./availability.js"`.

- [ ] **Step 3: Implement**

Create `shared/availability.js`:

```js
// shared/availability.js
//
// Dostupnost členů k výjezdu — veškerá pravidla na jednom místě. Čte je
// dashboard (karta Dostupnost k výjezdu) i Statistiky, takže se oba pohledy
// nemohou rozejít. Bez Firebase, testováno ve availability.test.js.

export const DAY_START = '05:00';
export const DAY_END = '18:00';
export const MAX_SLOTS = 3;
export const MIN_TRAVEL = 1;
export const MAX_TRAVEL = 180;
export const TRAVEL_PRESETS = [1, 2, 5, 10, 15, 20, 30];
export const WINDOW_DAYS = 14;

const TIME_RE = /^[0-2][0-9]:[0-5][0-9]$/;
const pad = (n) => String(n).padStart(2, '0');

// ---------- časy ----------

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

// ---------- data ----------

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + n));
}

export function monthDocIdsBetween(startISO, endISO) {
  const ids = [];
  let cursor = startISO;
  while (cursor <= endISO) {
    const id = cursor.slice(0, 7);
    if (!ids.includes(id)) ids.push(id);
    cursor = addDays(cursor, 1);
  }
  return ids;
}

export function formatDateCZ(iso, withYear = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return withYear ? `${d}. ${m}. ${y}` : `${d}. ${m}.`;
}

export function availabilityDocId(date, uid) {
  return `${date}_${uid}`;
}

// ---------- úseky ----------

export function validateSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return 'Přidejte alespoň jeden čas.';
  if (slots.length > MAX_SLOTS) return `Nejvýše ${MAX_SLOTS} časové úseky.`;

  for (const s of slots) {
    if (!TIME_RE.test(s.from || '') || !TIME_RE.test(s.to || '')) return 'Vyplňte čas od a do.';
    if (s.from < DAY_START || s.to > DAY_END) return 'Čas musí být mezi 05:00 a 18:00.';
    if (s.from >= s.to) return 'Čas „do“ musí být po čase „od“.';
    if (!Number.isInteger(s.travelMin) || s.travelMin < MIN_TRAVEL || s.travelMin > MAX_TRAVEL) {
      return 'Dojezd musí být 1–180 minut.';
    }
  }

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      const overlaps = a.from < b.to && b.from < a.to;
      if (overlaps && a.travelMin !== b.travelMin) return 'Časy se překrývají.';
    }
  }
  return null;
}

export function normalizeSlots(slots) {
  const sorted = (slots || [])
    .map(({ from, to, travelMin }) => ({ from, to, travelMin }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.travelMin === s.travelMin && s.from <= last.to) {
      if (s.to > last.to) last.to = s.to;
    } else {
      out.push({ ...s });
    }
  }
  return out;
}

export function slotsEqual(a, b) {
  return JSON.stringify(normalizeSlots(a)) === JSON.stringify(normalizeSlots(b));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/availability.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add shared/availability.js shared/availability.test.js
git commit -m "feat(dostupnost): shared slot validation, normalisation and date helpers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Crew coverage for one day

**Files:**
- Modify: `shared/availability.js` (append)
- Test: `shared/availability.test.js` (append)

**Interfaces:**
- Consumes: `DAY_START`, `DAY_END`, `toMinutes`, `fromMinutes`, `normalizeSlots` (Task 1).
- Produces:
  - `POSITIONS: { key: 'Velitel'|'Strojník'|'Hasič', eligible: string[] }[]` (4 entries), `CREW_SIZE = 4`
  - `getPrimaryRole(roles: string[]): 'Velitel'|'Strojník'|'Hasič'|null`
  - `isAbsentOn(absences, uid, date): boolean`
  - `computeDayCoverage({ date, members, availabilityDocs, absences, dayShift }) → Coverage`
    - `members`: `[{ uid, firstName, lastName, roles?, role?, approved?, disabled? }]`
    - `availabilityDocs`: `[{ uid, date, slots }]` (may contain other dates; filtered by `date`)
    - `dayShift`: `{ slotKey: { uid, name, timeFrom?, timeTo? } }` or `undefined`
    - `Coverage = { date, status: 'complete'|'partial'|'missing', filled: number, missing: string[], completeRanges: {from,to}[], people: Person[] }`
    - `Person = { uid, name, primaryRole, slots: Slot[], onDayShift: boolean, availableMinutes: number }` — sorted Velitel, Strojník, Hasič, null, then name (cs)
  - `describeCoverage(coverage): string`
  - `describePersonTimes(person): string`

- [ ] **Step 1: Write the failing tests**

Append to `shared/availability.test.js` (add the new names to the existing import list at the top of the file: `computeDayCoverage, describeCoverage, describePersonTimes, getPrimaryRole, isAbsentOn, CREW_SIZE`):

```js
const D = '2026-09-15';
const member = (uid, roles, extra = {}) => ({ uid, firstName: uid, lastName: 'Test', roles, approved: true, ...extra });
const fullDay = (travelMin = 5) => [{ from: '05:00', to: '18:00', travelMin }];
const avail = (uid, slots, date = D) => ({ uid, date, slots });

const crew = [
  member('v', ['VD', 'Hasič']),
  member('s', ['Strojník', 'Hasič']),
  member('h1', ['Hasič']),
  member('h2', ['Hasič']),
];

describe('getPrimaryRole', () => {
  it('velitel > strojník > hasič', () => {
    expect(getPrimaryRole(['Hasič', 'VJ'])).toBe('Velitel');
    expect(getPrimaryRole(['Zastupce VJ'])).toBe('Velitel');
    expect(getPrimaryRole(['Hasič', 'Strojník'])).toBe('Strojník');
    expect(getPrimaryRole(['Hasič'])).toBe('Hasič');
    expect(getPrimaryRole(['Admin', 'Přístup do Administrace'])).toBeNull();
    expect(getPrimaryRole(undefined)).toBeNull();
  });
});

describe('isAbsentOn', () => {
  it('včetně hraničních dnů', () => {
    const abs = [{ uid: 'a', startDate: '2026-09-10', endDate: '2026-09-15' }];
    expect(isAbsentOn(abs, 'a', '2026-09-10')).toBe(true);
    expect(isAbsentOn(abs, 'a', '2026-09-15')).toBe(true);
    expect(isAbsentOn(abs, 'a', '2026-09-16')).toBe(false);
    expect(isAbsentOn(abs, 'b', '2026-09-12')).toBe(false);
  });
});

describe('computeDayCoverage', () => {
  it('prázdný den chybí vše', () => {
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: [], absences: [], dayShift: undefined });
    expect(c.status).toBe('missing');
    expect(c.filled).toBe(0);
    expect(c.missing).toEqual(['Velitel', 'Strojník', 'Hasič', 'Hasič']);
    expect(c.people).toEqual([]);
    expect(CREW_SIZE).toBe(4);
  });

  it('čtyři lidé celý den = kompletní', () => {
    const docs = crew.map(m => avail(m.uid, fullDay()));
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences: [] });
    expect(c.status).toBe('complete');
    expect(c.filled).toBe(4);
    expect(c.missing).toEqual([]);
    expect(c.completeRanges).toEqual([{ from: '05:00', to: '18:00' }]);
    expect(c.people.map(p => p.uid)).toEqual(['v', 's', 'h1', 'h2']);
    expect(c.people[0].availableMinutes).toBe(13 * 60);
  });

  it('jeden člověk obsadí nejvýše jednu pozici', () => {
    const members = [member('vs', ['VD', 'Strojník']), member('h1', ['Hasič']), member('h2', ['Hasič'])];
    const docs = members.map(m => avail(m.uid, fullDay()));
    const c = computeDayCoverage({ date: D, members, availabilityDocs: docs, absences: [] });
    expect(c.status).toBe('missing');
    expect(c.filled).toBe(3);
    expect(c.missing).toHaveLength(1);
    expect(['Velitel', 'Strojník']).toContain(c.missing[0]);
  });

  it('strojník může zaplnit hasiče, když je strojník obsazen jinak', () => {
    const members = [member('v', ['VD']), member('s1', ['Strojník']), member('s2', ['Strojník']), member('h', ['Hasič'])];
    const docs = members.map(m => avail(m.uid, fullDay()));
    const c = computeDayCoverage({ date: D, members, availabilityDocs: docs, absences: [] });
    expect(c.status).toBe('complete');
  });

  it('mezera ve vlastních časech = částečně', () => {
    const docs = [
      avail('v', fullDay()),
      avail('s', fullDay()),
      avail('h1', fullDay()),
      avail('h2', [{ from: '05:00', to: '10:00', travelMin: 15 }, { from: '13:00', to: '18:00', travelMin: 2 }]),
    ];
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences: [] });
    expect(c.status).toBe('partial');
    expect(c.completeRanges).toEqual([{ from: '05:00', to: '10:00' }, { from: '13:00', to: '18:00' }]);
    expect(c.filled).toBe(4);
    expect(c.missing).toEqual([]);
    expect(c.people.find(p => p.uid === 'h2').availableMinutes).toBe(10 * 60);
  });

  it('absence přebíjí záznam', () => {
    const docs = crew.map(m => avail(m.uid, fullDay()));
    const absences = [{ uid: 'h2', startDate: '2026-09-14', endDate: '2026-09-16' }];
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences });
    expect(c.status).toBe('missing');
    expect(c.missing).toEqual(['Hasič']);
    expect(c.people.some(p => p.uid === 'h2')).toBe(false);
  });

  it('záznamy jiných dnů se ignorují', () => {
    const docs = crew.map(m => avail(m.uid, fullDay(), '2026-09-16'));
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences: [] });
    expect(c.filled).toBe(0);
  });

  it('denní služba bez časů se počítá celý den', () => {
    const docs = [avail('v', fullDay()), avail('s', fullDay()), avail('h1', fullDay())];
    const dayShift = { hasic1: { uid: 'h2', name: 'h2 Test' } };
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences: [], dayShift });
    expect(c.status).toBe('complete');
    const h2 = c.people.find(p => p.uid === 'h2');
    expect(h2.onDayShift).toBe(true);
    expect(h2.slots).toEqual([]);
  });

  it('denní služba s časy slotu', () => {
    const docs = [avail('v', fullDay()), avail('s', fullDay()), avail('h1', fullDay())];
    const dayShift = { hasic1: { uid: 'h2', name: 'h2 Test', timeFrom: '09:00', timeTo: '17:00' } };
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences: [], dayShift });
    expect(c.status).toBe('partial');
    expect(c.completeRanges).toEqual([{ from: '09:00', to: '17:00' }]);
  });

  it('denní služba přes půlnoc se ořízne do 18:00', () => {
    const docs = [avail('v', fullDay()), avail('s', fullDay()), avail('h1', fullDay())];
    const dayShift = { hasic1: { uid: 'h2', name: 'h2 Test', timeFrom: '13:00', timeTo: '02:00' } };
    const c = computeDayCoverage({ date: D, members: crew, availabilityDocs: docs, absences: [], dayShift });
    expect(c.completeRanges).toEqual([{ from: '13:00', to: '18:00' }]);
  });

  it('člen jen s rolí Admin se nepočítá', () => {
    const members = [...crew.slice(0, 3), member('adm', ['Admin'])];
    const docs = members.map(m => avail(m.uid, fullDay()));
    const c = computeDayCoverage({ date: D, members, availabilityDocs: docs, absences: [] });
    expect(c.missing).toEqual(['Hasič']);
    expect(c.people.find(p => p.uid === 'adm').primaryRole).toBeNull();
  });

  it('deaktivovaný a neschválený člen se ignoruje', () => {
    const members = [...crew.slice(0, 3), member('h2', ['Hasič'], { disabled: true }), member('h3', ['Hasič'], { approved: false })];
    const docs = members.map(m => avail(m.uid, fullDay()));
    const c = computeDayCoverage({ date: D, members, availabilityDocs: docs, absences: [] });
    expect(c.status).toBe('missing');
    expect(c.people.map(p => p.uid)).toEqual(['v', 's', 'h1']);
  });

  it('starší uživatel s polem role místo roles', () => {
    const members = [...crew.slice(0, 3), { uid: 'old', firstName: 'Old', lastName: 'Test', role: 'Hasič', approved: true }];
    const docs = members.map(m => avail(m.uid, fullDay()));
    const c = computeDayCoverage({ date: D, members, availabilityDocs: docs, absences: [] });
    expect(c.status).toBe('complete');
  });
});

describe('describeCoverage', () => {
  it('texty stavů', () => {
    expect(describeCoverage({ status: 'complete', completeRanges: [], missing: [] })).toBe('Kompletní');
    expect(describeCoverage({
      status: 'partial',
      completeRanges: [{ from: '05:00', to: '10:00' }, { from: '13:00', to: '18:00' }],
      missing: [],
    })).toBe('Kompletní jen 05:00–10:00, 13:00–18:00');
    expect(describeCoverage({ status: 'missing', completeRanges: [], missing: ['Strojník', 'Hasič'] }))
      .toBe('Chybí: Strojník, 1× Hasič');
    expect(describeCoverage({ status: 'missing', completeRanges: [], missing: ['Velitel', 'Strojník', 'Hasič', 'Hasič'] }))
      .toBe('Chybí: Velitel, Strojník, 2× Hasič');
  });
});

describe('describePersonTimes', () => {
  it('formáty', () => {
    expect(describePersonTimes({ slots: [] })).toBe('');
    expect(describePersonTimes({ slots: [{ from: '05:00', to: '18:00', travelMin: 5 }] })).toBe('🕒 5 min');
    expect(describePersonTimes({ slots: [{ from: '05:00', to: '10:00', travelMin: 15 }] })).toBe('05:00–10:00 · 🕒 15 min');
    expect(describePersonTimes({
      slots: [{ from: '05:00', to: '10:00', travelMin: 15 }, { from: '13:00', to: '18:00', travelMin: 2 }],
    })).toBe('05:00–10:00 (15 min), 13:00–18:00 (2 min)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/availability.test.js`
Expected: FAIL — `computeDayCoverage is not a function` (and the other new names).

- [ ] **Step 3: Implement**

Append to `shared/availability.js`:

```js
// ---------- posádka ----------

const COMMANDER_ROLES = ['VD', 'Zástupce VJ', 'Zastupce VJ', 'VJ'];
const FIREFIGHTER_ROLES = ['Hasič', 'Strojník', ...COMMANDER_ROLES];

export const POSITIONS = [
  { key: 'Velitel', eligible: COMMANDER_ROLES },
  { key: 'Strojník', eligible: ['Strojník'] },
  { key: 'Hasič', eligible: FIREFIGHTER_ROLES },
  { key: 'Hasič', eligible: FIREFIGHTER_ROLES },
];
export const CREW_SIZE = POSITIONS.length;

const ROLE_ORDER = ['Velitel', 'Strojník', 'Hasič'];

export function getPrimaryRole(roles) {
  const r = roles || [];
  if (r.some(x => COMMANDER_ROLES.includes(x))) return 'Velitel';
  if (r.includes('Strojník')) return 'Strojník';
  if (r.includes('Hasič')) return 'Hasič';
  return null;
}

export function isAbsentOn(absences, uid, date) {
  return (absences || []).some(a => a.uid === uid && a.startDate <= date && a.endDate >= date);
}

function memberRoles(m) {
  return Array.isArray(m.roles) ? m.roles : [m.role || 'Hasič'];
}

function memberName(m) {
  return `${m.firstName || ''} ${m.lastName || ''}`.trim() || 'Neznámý';
}

function clampInterval(fromMin, toMin) {
  const f = Math.max(fromMin, toMinutes(DAY_START));
  const t = Math.min(toMin, toMinutes(DAY_END));
  return f < t ? [f, t] : null;
}

function dayShiftInterval(slot) {
  if (slot.timeFrom && slot.timeTo) {
    const f = toMinutes(slot.timeFrom);
    const t = toMinutes(slot.timeTo);
    // Služba přes půlnoc (např. 13:00–02:00) — pro denní okno platí do jeho konce.
    return clampInterval(f, t <= f ? toMinutes(DAY_END) : t);
  }
  return [toMinutes(DAY_START), toMinutes(DAY_END)];
}

function unionMinutes(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const [f, t] of sorted) {
    if (!cur || f > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [f, t];
    } else if (t > cur[1]) {
      cur[1] = t;
    }
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

// Maximální obsazení pozic (bipartitní párování, augmentující cesty).
function assignPositions(people) {
  const assignedTo = new Array(POSITIONS.length).fill(null);
  const canFill = (person, pos) => POSITIONS[pos].eligible.some(r => person.roles.includes(r));

  const tryAssign = (pi, seen) => {
    for (let pos = 0; pos < POSITIONS.length; pos++) {
      if (seen[pos] || !canFill(people[pi], pos)) continue;
      seen[pos] = true;
      if (assignedTo[pos] === null || tryAssign(assignedTo[pos], seen)) {
        assignedTo[pos] = pi;
        return true;
      }
    }
    return false;
  };

  people.forEach((_, pi) => tryAssign(pi, new Array(POSITIONS.length).fill(false)));

  return {
    filled: assignedTo.filter(x => x !== null).length,
    missing: POSITIONS.filter((_, i) => assignedTo[i] === null).map(p => p.key),
  };
}

export function computeDayCoverage({ date, members, availabilityDocs, absences, dayShift }) {
  const byUid = new Map();
  for (const m of members || []) {
    if (m.approved === false || m.disabled) continue;
    const uid = m.uid || m.id;
    if (isAbsentOn(absences, uid, date)) continue;
    const roles = memberRoles(m);
    byUid.set(uid, {
      uid,
      name: memberName(m),
      roles,
      primaryRole: getPrimaryRole(roles),
      slots: [],
      onDayShift: false,
      intervals: [],
    });
  }

  for (const d of availabilityDocs || []) {
    if (d.date !== date) continue;
    const p = byUid.get(d.uid);
    if (!p) continue;
    p.slots = normalizeSlots(d.slots || []);
    for (const s of p.slots) {
      const iv = clampInterval(toMinutes(s.from), toMinutes(s.to));
      if (iv) p.intervals.push(iv);
    }
  }

  for (const slot of Object.values(dayShift || {})) {
    if (!slot || !slot.uid) continue;
    const p = byUid.get(slot.uid);
    if (!p) continue;
    const iv = dayShiftInterval(slot);
    if (iv) {
      p.intervals.push(iv);
      p.onDayShift = true;
    }
  }

  const present = [...byUid.values()].filter(p => p.intervals.length > 0);

  const bounds = new Set([toMinutes(DAY_START), toMinutes(DAY_END)]);
  present.forEach(p => p.intervals.forEach(([f, t]) => { bounds.add(f); bounds.add(t); }));
  const points = [...bounds].sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const here = present.filter(p => p.intervals.some(([f, t]) => f <= start && t >= end));
    segments.push({ start, end, ...assignPositions(here) });
  }

  const completeSegments = segments.filter(s => s.filled === CREW_SIZE);
  const status = completeSegments.length === segments.length
    ? 'complete'
    : completeSegments.length > 0 ? 'partial' : 'missing';

  const completeRanges = [];
  for (const s of completeSegments) {
    const last = completeRanges[completeRanges.length - 1];
    if (last && last.end === s.start) last.end = s.end;
    else completeRanges.push({ start: s.start, end: s.end });
  }

  let best = segments[0];
  for (const s of segments) {
    if (s.filled > best.filled || (s.filled === best.filled && s.end - s.start > best.end - best.start)) best = s;
  }

  const rank = (role) => (role === null ? ROLE_ORDER.length : ROLE_ORDER.indexOf(role));
  const people = present
    .map(p => ({
      uid: p.uid,
      name: p.name,
      primaryRole: p.primaryRole,
      slots: p.slots,
      onDayShift: p.onDayShift,
      availableMinutes: unionMinutes(p.intervals),
    }))
    .sort((a, b) => rank(a.primaryRole) - rank(b.primaryRole) || a.name.localeCompare(b.name, 'cs'));

  return {
    date,
    status,
    filled: best.filled,
    missing: best.missing,
    completeRanges: completeRanges.map(r => ({ from: fromMinutes(r.start), to: fromMinutes(r.end) })),
    people,
  };
}

// ---------- texty pro zobrazení ----------

export function describeCoverage(coverage) {
  if (coverage.status === 'complete') return 'Kompletní';
  if (coverage.status === 'partial') {
    return `Kompletní jen ${coverage.completeRanges.map(r => `${r.from}–${r.to}`).join(', ')}`;
  }
  const parts = [];
  if (coverage.missing.includes('Velitel')) parts.push('Velitel');
  if (coverage.missing.includes('Strojník')) parts.push('Strojník');
  const hasici = coverage.missing.filter(k => k === 'Hasič').length;
  if (hasici > 0) parts.push(`${hasici}× Hasič`);
  return `Chybí: ${parts.join(', ')}`;
}

export function describePersonTimes(person) {
  const slots = person.slots || [];
  if (slots.length === 0) return '';
  if (slots.length === 1) {
    const s = slots[0];
    if (s.from === DAY_START && s.to === DAY_END) return `🕒 ${s.travelMin} min`;
    return `${s.from}–${s.to} · 🕒 ${s.travelMin} min`;
  }
  return slots.map(s => `${s.from}–${s.to} (${s.travelMin} min)`).join(', ');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/availability.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/availability.js shared/availability.test.js
git commit -m "feat(dostupnost): compute daily crew coverage with one position per person

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Month summary, week copy plan and log texts

**Files:**
- Modify: `shared/availability.js` (append)
- Test: `shared/availability.test.js` (append)

**Interfaces:**
- Consumes: everything from Tasks 1–2; `pluralize(n, one, few, many)` from `src/utils/pluralize.js`.
- Produces:
  - `summarizeMonth({ year, month, todayISO, members, availabilityDocs, absences, dayShiftsByDate }) → { counts: { complete, partial, missing }, missingByPosition: { Velitel, Strojník, Hasič }, memberHours: [{ uid, name, hours, avgTravelMin }], perDay: Coverage[] }`
    - `month` is 1–12; `dayShiftsByDate` is `{ 'YYYY-MM-DD': dayShiftObject }`; days after `todayISO` are skipped; `hours` rounded to 0.1; `avgTravelMin` rounded integer or `null`; `memberHours` excludes 0 h, sorted by hours desc then name.
  - `planWeekCopy({ uid, todayISO, availabilityDocs, absences }) → [{ date, slots }]`
  - `buildLogDetail(kind: 'added'|'updated'|'removed'|'copied', { date?, slots?, previousSlots?, dates? }) → string`

- [ ] **Step 1: Write the failing tests**

Add `summarizeMonth, planWeekCopy, buildLogDetail` to the import list at the top of `shared/availability.test.js`, then append:

```js
describe('summarizeMonth', () => {
  const docs = [
    // 1. 9. — všichni celý den → kompletní
    ...crew.map(m => avail(m.uid, fullDay(), '2026-09-01')),
    // 2. 9. — chybí h2 → chybí Hasič
    ...crew.slice(0, 3).map(m => avail(m.uid, fullDay(), '2026-09-02')),
    // 3. 9. — h2 jen ráno za 10 min → částečně
    ...crew.slice(0, 3).map(m => avail(m.uid, fullDay(), '2026-09-03')),
    avail('h2', [{ from: '05:00', to: '10:00', travelMin: 10 }], '2026-09-03'),
    // 4. 9. — budoucnost, nesmí se započítat
    ...crew.map(m => avail(m.uid, fullDay(), '2026-09-04')),
  ];

  const summary = summarizeMonth({
    year: 2026,
    month: 9,
    todayISO: '2026-09-03',
    members: crew,
    availabilityDocs: docs,
    absences: [],
    dayShiftsByDate: {},
  });

  it('počty stavů jen do dneška', () => {
    expect(summary.counts).toEqual({ complete: 1, partial: 1, missing: 1 });
    expect(summary.perDay.map(d => d.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('chybějící pozice po dnech', () => {
    expect(summary.missingByPosition).toEqual({ Velitel: 0, Strojník: 0, Hasič: 1 });
  });

  it('hodiny a vážený průměr dojezdu', () => {
    const v = summary.memberHours.find(m => m.uid === 'v');
    const h2 = summary.memberHours.find(m => m.uid === 'h2');
    expect(v.hours).toBe(39);
    expect(v.avgTravelMin).toBe(5);
    expect(h2.hours).toBe(18);
    // (13 h × 5 min + 5 h × 10 min) / 18 h = 6,39 → 6
    expect(h2.avgTravelMin).toBe(6);
    expect(summary.memberHours[3].uid).toBe('h2');
  });

  it('denní služba se do průměru dojezdu nepočítá', () => {
    const s = summarizeMonth({
      year: 2026,
      month: 9,
      todayISO: '2026-09-01',
      members: crew,
      availabilityDocs: [],
      absences: [],
      dayShiftsByDate: { '2026-09-01': { hasic1: { uid: 'h1', name: 'h1 Test' } } },
    });
    expect(s.memberHours).toEqual([{ uid: 'h1', name: 'h1 Test', hours: 13, avgTravelMin: null }]);
  });

  it('měsíc v budoucnosti je prázdný', () => {
    const s = summarizeMonth({
      year: 2026, month: 10, todayISO: '2026-09-03',
      members: crew, availabilityDocs: docs, absences: [], dayShiftsByDate: {},
    });
    expect(s.perDay).toEqual([]);
    expect(s.counts).toEqual({ complete: 0, partial: 0, missing: 0 });
  });
});

describe('planWeekCopy', () => {
  it('kopíruje moje dny 1–7 na 8–14 bez přepisu a mimo absence', () => {
    const docs = [
      avail('me', fullDay(), '2026-09-14'),
      avail('me', [{ from: '13:00', to: '18:00', travelMin: 2 }, { from: '05:00', to: '10:00', travelMin: 15 }], '2026-09-16'),
      avail('me', fullDay(), '2026-09-17'),
      avail('me', fullDay(3), '2026-09-24'), // cíl pro 17. už existuje
      avail('other', fullDay(), '2026-09-15'), // cizí záznam
    ];
    const absences = [{ uid: 'me', startDate: '2026-09-23', endDate: '2026-09-23' }]; // cíl pro 16.
    const plan = planWeekCopy({ uid: 'me', todayISO: '2026-09-14', availabilityDocs: docs, absences });
    expect(plan).toEqual([{ date: '2026-09-21', slots: fullDay() }]);
  });

  it('nic ke kopírování', () => {
    expect(planWeekCopy({ uid: 'me', todayISO: '2026-09-14', availabilityDocs: [], absences: [] })).toEqual([]);
  });
});

describe('buildLogDetail', () => {
  const two = [{ from: '05:00', to: '10:00', travelMin: 15 }, { from: '13:00', to: '18:00', travelMin: 2 }];

  it('přidání', () => {
    expect(buildLogDetail('added', { date: '2026-09-15', slots: fullDay() }))
      .toBe('Označil se jako dostupný na 15. 9. 2026 (05:00–18:00, dojezd 5 min)');
  });

  it('úprava', () => {
    expect(buildLogDetail('updated', { date: '2026-09-15', slots: two, previousSlots: fullDay() }))
      .toBe('Změnil dostupnost na 15. 9. 2026: 05:00–10:00 (dojezd 15 min), 13:00–18:00 (dojezd 2 min) (dříve 05:00–18:00, dojezd 5 min)');
  });

  it('zrušení', () => {
    expect(buildLogDetail('removed', { date: '2026-09-15', previousSlots: two }))
      .toBe('Zrušil dostupnost na 15. 9. 2026 (bylo 05:00–10:00, 13:00–18:00)');
  });

  it('kopírování týdne', () => {
    expect(buildLogDetail('copied', { dates: ['2026-09-27', '2026-09-22', '2026-09-23'] }))
      .toBe('Zkopíroval dostupnost na další týden: 22. 9., 23. 9., 27. 9. 2026 (3 dny)');
    expect(buildLogDetail('copied', { dates: ['2026-09-22'] }))
      .toBe('Zkopíroval dostupnost na další týden: 22. 9. 2026 (1 den)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/availability.test.js`
Expected: FAIL — `summarizeMonth is not a function` (and `planWeekCopy`, `buildLogDetail`).

- [ ] **Step 3: Implement**

At the very top of `shared/availability.js`, below the header comment, add:

```js
import { pluralize } from '../src/utils/pluralize.js';
```

Append to `shared/availability.js`:

```js
// ---------- statistiky ----------

export function summarizeMonth({ year, month, todayISO, members, availabilityDocs, absences, dayShiftsByDate }) {
  const counts = { complete: 0, partial: 0, missing: 0 };
  const missingByPosition = { Velitel: 0, Strojník: 0, Hasič: 0 };
  const totals = new Map();
  const perDay = [];
  const lastDay = new Date(year, month, 0).getDate();

  for (let d = 1; d <= lastDay; d++) {
    const date = `${year}-${pad(month)}-${pad(d)}`;
    if (date > todayISO) break;

    const coverage = computeDayCoverage({
      date,
      members,
      availabilityDocs,
      absences,
      dayShift: dayShiftsByDate?.[date],
    });
    counts[coverage.status]++;
    new Set(coverage.missing).forEach(key => { missingByPosition[key]++; });

    for (const p of coverage.people) {
      if (!totals.has(p.uid)) totals.set(p.uid, { uid: p.uid, name: p.name, minutes: 0, travelWeighted: 0, travelMinutes: 0 });
      const t = totals.get(p.uid);
      t.minutes += p.availableMinutes;
      for (const s of p.slots) {
        const iv = clampInterval(toMinutes(s.from), toMinutes(s.to));
        if (!iv) continue;
        const len = iv[1] - iv[0];
        t.travelWeighted += s.travelMin * len;
        t.travelMinutes += len;
      }
    }
    perDay.push(coverage);
  }

  const memberHours = [...totals.values()]
    .filter(t => t.minutes > 0)
    .map(t => ({
      uid: t.uid,
      name: t.name,
      hours: Math.round((t.minutes / 60) * 10) / 10,
      avgTravelMin: t.travelMinutes > 0 ? Math.round(t.travelWeighted / t.travelMinutes) : null,
    }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name, 'cs'));

  return { counts, missingByPosition, memberHours, perDay };
}

// ---------- kopírování týdne ----------

export function planWeekCopy({ uid, todayISO, availabilityDocs, absences }) {
  const mine = new Map((availabilityDocs || []).filter(d => d.uid === uid).map(d => [d.date, d]));
  const plan = [];
  for (let i = 0; i < 7; i++) {
    const source = mine.get(addDays(todayISO, i));
    const target = addDays(todayISO, i + 7);
    if (!source || mine.has(target) || isAbsentOn(absences, uid, target)) continue;
    plan.push({ date: target, slots: normalizeSlots(source.slots) });
  }
  return plan;
}

// ---------- logy ----------

function formatRanges(slots) {
  return slots.map(s => `${s.from}–${s.to}`).join(', ');
}

function describeSlotsForLog(slots) {
  if (slots.length === 1) return `${slots[0].from}–${slots[0].to}, dojezd ${slots[0].travelMin} min`;
  return slots.map(s => `${s.from}–${s.to} (dojezd ${s.travelMin} min)`).join(', ');
}

export function buildLogDetail(kind, { date, slots, previousSlots, dates } = {}) {
  switch (kind) {
    case 'added':
      return `Označil se jako dostupný na ${formatDateCZ(date)} (${describeSlotsForLog(slots)})`;
    case 'updated':
      return `Změnil dostupnost na ${formatDateCZ(date)}: ${describeSlotsForLog(slots)} (dříve ${describeSlotsForLog(previousSlots)})`;
    case 'removed':
      return `Zrušil dostupnost na ${formatDateCZ(date)} (bylo ${formatRanges(previousSlots)})`;
    case 'copied': {
      const sorted = [...dates].sort();
      const list = sorted.map((d, i) => formatDateCZ(d, i === sorted.length - 1)).join(', ');
      const n = sorted.length;
      return `Zkopíroval dostupnost na další týden: ${list} (${n} ${pluralize(n, 'den', 'dny', 'dní')})`;
    }
    default:
      throw new Error(`Unknown availability log kind: ${kind}`);
  }
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: PASS — all test files, including the existing 61 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/availability.js shared/availability.test.js
git commit -m "feat(dostupnost): month summary, week-copy plan and log texts

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Log category/actions and Firestore rules

**Files:**
- Modify: `src/components/admin/constants.js` (CATEGORY_CONFIG around line 13–20, ACTION_LABELS around line 22–90)
- Modify: `firestore.rules`

**Interfaces:**
- Produces: log category key `availability`; action keys `AVAILABILITY_ADDED`, `AVAILABILITY_UPDATED`, `AVAILABILITY_REMOVED`, `AVAILABILITY_COPIED_WEEK` (used by Task 5).

- [ ] **Step 1: Add the log category**

In `src/components/admin/constants.js`, inside `CATEGORY_CONFIG`, add after the `cleaning` line:

```js
  availability: { label: 'Dostupnost', color: 'var(--indigo-deep)', bg: 'var(--indigo-bg)', border: 'var(--indigo)', icon: '🚑' },
```

(`--indigo-deep`, `--indigo-bg`, `--indigo` already have dark-theme values in `src/index.css`, lines ~278–281 — no CSS change needed.)

- [ ] **Step 2: Add action labels**

In the same file, inside `ACTION_LABELS`, add after the `CLEANING_DELETED` line:

```js
  AVAILABILITY_ADDED:        'Přidána dostupnost',
  AVAILABILITY_UPDATED:      'Upravena dostupnost',
  AVAILABILITY_REMOVED:      'Zrušena dostupnost',
  AVAILABILITY_COPIED_WEEK:  'Dostupnost zkopírována na další týden',
```

- [ ] **Step 3: Update Firestore rules**

In `firestore.rules`, add `validSlot` next to the other helper functions (after `isElevated()`):

```
    function validSlot(s) {
      return s.from is string && s.to is string
        && s.from.matches('^[0-2][0-9]:[0-5][0-9]$')
        && s.to.matches('^[0-2][0-9]:[0-5][0-9]$')
        && s.from >= '05:00' && s.from < s.to && s.to <= '18:00'
        && s.travelMin is int && s.travelMin >= 1 && s.travelMin <= 180;
    }
```

Change the catch-all block to also exclude `availability`:

```
    match /{collection}/{document=**} {
      allow read, write: if isSignedIn()
        && collection != 'quizzes'
        && collection != 'quizAnswerKeys'
        && collection != 'quizAttempts'
        && collection != 'availability';
    }
```

Add before the `pushSubscriptions` block:

```
    // Dostupnost k výjezdu — číst smí každý přihlášený, zapisovat jen vlastní záznam.
    match /availability/{docId} {
      allow read: if isSignedIn();
      allow create, update: if isSignedIn()
        && request.resource.data.uid == request.auth.uid
        && docId == request.resource.data.date + '_' + request.auth.uid
        && request.resource.data.slots is list
        && request.resource.data.slots.size() >= 1
        && request.resource.data.slots.size() <= 3
        && validSlot(request.resource.data.slots[0])
        && (request.resource.data.slots.size() < 2 || validSlot(request.resource.data.slots[1]))
        && (request.resource.data.slots.size() < 3 || validSlot(request.resource.data.slots[2]));
      allow delete: if isSignedIn() && resource.data.uid == request.auth.uid;
    }
```

- [ ] **Step 4: Verify build and lint**

Run: `npm run build`
Expected: build succeeds (`files generated`).
Run: `npm run lint`
Expected: no new errors in `src/components/admin/constants.js`.

Rules cannot be tested locally (no emulator in this project). Record for the final summary: after merge, paste `firestore.rules` into Firebase console → Firestore → Rules, and in the Rules Playground check (a) `create` on `availability/2026-09-15_<myUid>` with valid data → allowed, (b) same with another uid → denied, (c) `travelMin: 0` → denied.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/constants.js firestore.rules
git commit -m "feat(dostupnost): log category, action labels and firestore rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Data + actions hook

**Files:**
- Create: `src/hooks/useAvailability.js`

**Interfaces:**
- Consumes: `monthDocIdsBetween`, `availabilityDocId`, `normalizeSlots`, `slotsEqual`, `buildLogDetail`, `planWeekCopy` (shared); `logAction(db, uid, userName, action, category, detail)` from `src/utils/logger.js`; `useAuth()` → `{ currentUser, userData }`; `useToast()` → `{ addToast(type, message) }` with types `success|error|warning|info`; `pluralize` from `src/utils/pluralize.js`.
- Produces:
  - `useAvailabilityData(startISO, endISO) → { loading: boolean, availabilityDocs: {id, uid, date, slots}[], absences: object[], members: object[] (with uid = doc id), dayShiftsByDate: { [iso]: dayShiftObject } }`
  - `useAvailabilityActions() → { busy: boolean, saveDay(date, slots, previousSlots?) → Promise<boolean>, removeDay(date, previousSlots) → Promise<boolean>, copyWeek({ todayISO, availabilityDocs, absences }) → Promise<void>, rememberedTravel: number | null }`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useAvailability.js`:

```js
import { useEffect, useState, useCallback } from 'react';
import {
  collection, doc, onSnapshot, query, where, setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logAction } from '../utils/logger';
import { pluralize } from '../utils/pluralize';
import {
  monthDocIdsBetween, availabilityDocId, normalizeSlots, slotsEqual, buildLogDetail, planWeekCopy,
} from '../../shared/availability.js';

// Načte vše, co potřebuje výpočet posádky pro rozsah dní: záznamy dostupnosti,
// absence, denní služby z měsíčních dokumentů `shifts` a schválené členy.
export function useAvailabilityData(startISO, endISO) {
  const [availabilityDocs, setAvailabilityDocs] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [members, setMembers] = useState([]);
  const [dayShiftsByDate, setDayShiftsByDate] = useState({});
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);

  useEffect(() => {
    const availabilityQuery = query(
      collection(db, 'availability'),
      where('date', '>=', startISO),
      where('date', '<=', endISO),
    );
    const unsubAvailability = onSnapshot(availabilityQuery, (snap) => {
      setAvailabilityDocs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAvailabilityLoaded(true);
    }, (err) => {
      console.error('Error loading availability:', err);
      setAvailabilityLoaded(true);
    });

    const unsubAbsences = onSnapshot(doc(db, 'absences', 'global'), (snap) => {
      setAbsences(snap.exists() ? (snap.data().items || []) : []);
    });

    const unsubMembers = onSnapshot(query(collection(db, 'users'), where('approved', '==', true)), (snap) => {
      setMembers(snap.docs.map(d => ({ ...d.data(), uid: d.id })));
      setMembersLoaded(true);
    }, (err) => {
      console.error('Error loading members:', err);
      setMembersLoaded(true);
    });

    const unsubShifts = monthDocIdsBetween(startISO, endISO).map(monthId =>
      onSnapshot(doc(db, 'shifts', monthId), (snap) => {
        const days = snap.exists() ? (snap.data().days || {}) : {};
        setDayShiftsByDate(prev => {
          const next = Object.fromEntries(Object.entries(prev).filter(([iso]) => !iso.startsWith(monthId)));
          Object.entries(days).forEach(([dayKey, dayData]) => {
            if (dayData?.dayShift) next[`${monthId}-${String(dayKey).padStart(2, '0')}`] = dayData.dayShift;
          });
          return next;
        });
      }),
    );

    return () => {
      unsubAvailability();
      unsubAbsences();
      unsubMembers();
      unsubShifts.forEach(unsub => unsub());
    };
  }, [startISO, endISO]);

  return {
    loading: !(availabilityLoaded && membersLoaded),
    availabilityDocs,
    absences,
    members,
    dayShiftsByDate,
  };
}

// Zápisy vlastní dostupnosti. Firestore promítne zápis do onSnapshot okamžitě
// a při odmítnutí ho sám vrátí, UI proto nepotřebuje vlastní optimistický stav.
export function useAvailabilityActions() {
  const { currentUser, userData } = useAuth();
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);

  const uid = currentUser?.uid;
  const userName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim();
  const rememberedTravel = userData?.preferences?.availabilityTravelMin ?? null;

  const rememberTravel = useCallback(async (travelMin) => {
    if (rememberedTravel === travelMin) return;
    try {
      await updateDoc(doc(db, 'users', uid), { 'preferences.availabilityTravelMin': travelMin });
    } catch (err) {
      console.warn('Failed to remember travel time:', err);
    }
  }, [uid, rememberedTravel]);

  const saveDay = useCallback(async (date, slots, previousSlots) => {
    const normalized = normalizeSlots(slots);
    setBusy(true);
    try {
      await setDoc(doc(db, 'availability', availabilityDocId(date, uid)), {
        uid,
        date,
        slots: normalized,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error saving availability:', err);
      addToast('error', 'Chyba při ukládání dostupnosti');
      setBusy(false);
      return false;
    }
    setBusy(false);

    if (previousSlots?.length) {
      if (!slotsEqual(previousSlots, normalized)) {
        logAction(db, uid, userName, 'AVAILABILITY_UPDATED', 'availability',
          buildLogDetail('updated', { date, slots: normalized, previousSlots: normalizeSlots(previousSlots) }));
      }
    } else {
      logAction(db, uid, userName, 'AVAILABILITY_ADDED', 'availability',
        buildLogDetail('added', { date, slots: normalized }));
    }
    rememberTravel(normalized[normalized.length - 1].travelMin);
    return true;
  }, [uid, userName, addToast, rememberTravel]);

  const removeDay = useCallback(async (date, previousSlots) => {
    setBusy(true);
    try {
      await deleteDoc(doc(db, 'availability', availabilityDocId(date, uid)));
    } catch (err) {
      console.error('Error removing availability:', err);
      addToast('error', 'Chyba při ukládání dostupnosti');
      setBusy(false);
      return false;
    }
    setBusy(false);
    logAction(db, uid, userName, 'AVAILABILITY_REMOVED', 'availability',
      buildLogDetail('removed', { date, previousSlots: normalizeSlots(previousSlots || []) }));
    return true;
  }, [uid, userName, addToast]);

  const copyWeek = useCallback(async ({ todayISO, availabilityDocs, absences }) => {
    const plan = planWeekCopy({ uid, todayISO, availabilityDocs, absences });
    if (plan.length === 0) {
      addToast('info', 'Není co kopírovat');
      return;
    }
    setBusy(true);
    try {
      const batch = writeBatch(db);
      plan.forEach(({ date, slots }) => {
        batch.set(doc(db, 'availability', availabilityDocId(date, uid)), {
          uid, date, slots, updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error copying availability:', err);
      addToast('error', 'Chyba při ukládání dostupnosti');
      setBusy(false);
      return;
    }
    setBusy(false);
    const n = plan.length;
    addToast('success', `Zkopírováno na ${n} ${pluralize(n, 'den', 'dny', 'dní')}`);
    logAction(db, uid, userName, 'AVAILABILITY_COPIED_WEEK', 'availability',
      buildLogDetail('copied', { dates: plan.map(p => p.date) }));
  }, [uid, userName, addToast]);

  return { busy, saveDay, removeDay, copyWeek, rememberedTravel };
}
```

- [ ] **Step 2: Verify build and lint**

Run: `npm run build`
Expected: succeeds (the hook is not imported yet, but must parse).
Run: `npx eslint src/hooks/useAvailability.js`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAvailability.js
git commit -m "feat(dostupnost): hook for loading availability data and saving own entries

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Dashboard card

**Files:**
- Create: `src/components/dashboard/availability/statusStyle.js`
- Create: `src/components/dashboard/availability/DayStrip.jsx`
- Create: `src/components/dashboard/availability/TravelPicker.jsx`
- Create: `src/components/dashboard/availability/SlotEditor.jsx`
- Create: `src/components/dashboard/availability/DayPanel.jsx`
- Create: `src/components/dashboard/availability/AvailabilityCard.jsx`
- Modify: `src/pages/DashboardPage.jsx` (imports; render between `</header>` and `{/* Weather Warnings */}`, around line 91–94)

**Interfaces:**
- Consumes: `useAvailabilityData`, `useAvailabilityActions` (Task 5); shared `toISODate`, `addDays`, `WINDOW_DAYS`, `CREW_SIZE`, `DAY_START`, `DAY_END`, `MAX_SLOTS`, `MIN_TRAVEL`, `MAX_TRAVEL`, `TRAVEL_PRESETS`, `computeDayCoverage`, `describeCoverage`, `describePersonTimes`, `formatDateCZ`, `isAbsentOn`, `validateSlots`.
- Produces (used by Task 7):
  - `STATUS_STYLE` from `statusStyle.js`: `{ complete|partial|missing: { icon, color, bg, border } }`
  - `<DayPanel coverage readOnly? me? busy? onSave? onRemove? />` where `me = { doc: {slots} | undefined, absent: boolean, onDayShift: boolean, rememberedTravel: number | null }`, `onSave(slots) → Promise<boolean>`, `onRemove() → Promise<boolean>`. Parent must pass `key={coverage.date}` so edit state resets when the day changes.

- [ ] **Step 1: Status styles**

Create `src/components/dashboard/availability/statusStyle.js`:

```js
export const STATUS_STYLE = {
  complete: { icon: '🟢', color: 'var(--success-text)', bg: 'var(--success-bg)', border: 'var(--success-border-strong)' },
  partial: { icon: '🟡', color: 'var(--warning-dark)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
  missing: { icon: '🔴', color: 'var(--danger-text)', bg: 'var(--danger-bg)', border: 'var(--danger-border-strong)' },
};
```

- [ ] **Step 2: Day strip**

Create `src/components/dashboard/availability/DayStrip.jsx`:

```jsx
import React from 'react';
import { CREW_SIZE } from '../../../../shared/availability.js';
import { STATUS_STYLE } from './statusStyle';

const WEEKDAYS = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

export default function DayStrip({ days, selectedDate, onSelect, myUid, myAbsentDates, loading }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.4rem', marginBottom: '0.75rem' }}>
      {days.map((coverage) => {
        const [y, m, d] = coverage.date.split('-').map(Number);
        const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
        const style = STATUS_STYLE[coverage.status];
        const selected = coverage.date === selectedDate;
        const mine = coverage.people.some(p => p.uid === myUid);
        const absent = myAbsentDates.has(coverage.date);

        return (
          <button
            key={coverage.date}
            type="button"
            onClick={() => onSelect(coverage.date)}
            aria-pressed={selected}
            aria-label={`${weekday} ${d}. ${m}.`}
            style={{
              flex: '0 0 auto',
              minWidth: '3.6rem',
              padding: '0.45rem 0.3rem',
              borderRadius: '10px',
              border: `2px solid ${selected ? 'var(--text-primary)' : mine && !loading ? style.border : 'transparent'}`,
              background: loading ? 'var(--surface-alt)' : style.bg,
              color: loading ? 'var(--text-muted)' : style.color,
              opacity: absent ? 0.45 : 1,
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{weekday}</div>
            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{d}.</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700 }}>{loading ? '…' : `${coverage.filled}/${CREW_SIZE}`}</div>
            {mine && !loading && <div style={{ fontSize: '0.6rem', fontWeight: 700 }}>✓ já</div>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Travel picker**

Create `src/components/dashboard/availability/TravelPicker.jsx`:

```jsx
import React, { useState } from 'react';
import { TRAVEL_PRESETS, MIN_TRAVEL, MAX_TRAVEL } from '../../../../shared/availability.js';

export default function TravelPicker({ busy, onPick, onCancel }) {
  const [custom, setCustom] = useState('');
  const customNumber = Number(custom);
  const customValid = custom !== '' && Number.isInteger(customNumber) && customNumber >= MIN_TRAVEL && customNumber <= MAX_TRAVEL;

  return (
    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--surface-alt)', marginBottom: '0.75rem' }}>
      <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Za jak dlouho jsi na stanici?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {TRAVEL_PRESETS.map(min => (
          <button key={min} type="button" className="btn btn-secondary" disabled={busy} onClick={() => onPick(min)}
            style={{ padding: '0.4rem 0.7rem', fontSize: '0.85rem' }}>
            {min} min
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} htmlFor="travel-custom">Jiný:</label>
        <input id="travel-custom" className="input-field" type="number" min={MIN_TRAVEL} max={MAX_TRAVEL} step="1"
          value={custom} onChange={e => setCustom(e.target.value)} style={{ width: '5rem' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>min</span>
        <button type="button" className="btn btn-primary" disabled={busy || !customValid} onClick={() => onPick(customNumber)}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          Uložit
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
          Zrušit
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Slot editor**

Create `src/components/dashboard/availability/SlotEditor.jsx`:

```jsx
import React, { useState } from 'react';
import { DAY_START, DAY_END, MAX_SLOTS, MIN_TRAVEL, MAX_TRAVEL, TRAVEL_PRESETS, validateSlots } from '../../../../shared/availability.js';

const toRow = (slot) => ({ ...slot, custom: !TRAVEL_PRESETS.includes(slot.travelMin) });

export default function SlotEditor({ initialSlots, defaultTravel, busy, onSave, onCancel, onRemove }) {
  const fallbackTravel = defaultTravel || 5;
  const [rows, setRows] = useState(() =>
    (initialSlots?.length ? initialSlots : [{ from: DAY_START, to: DAY_END, travelMin: fallbackTravel }]).map(toRow),
  );

  const slots = rows.map(({ from, to, travelMin }) => ({ from, to, travelMin }));
  const error = validateSlots(slots);

  const update = (index, patch) => setRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeRow = (index) => {
    if (rows.length === 1) {
      if (onRemove) onRemove();
      else onCancel();
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const addRow = () => setRows(prev => [...prev, toRow({ from: '13:00', to: DAY_END, travelMin: fallbackTravel })]);

  return (
    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--surface-alt)', marginBottom: '0.75rem' }}>
      {rows.map((row, i) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <input className="input-field" type="time" min={DAY_START} max={DAY_END} step="60" aria-label="Od"
            value={row.from} onChange={e => update(i, { from: e.target.value })} style={{ width: '6.5rem' }} />
          <span style={{ color: 'var(--text-secondary)' }}>–</span>
          <input className="input-field" type="time" min={DAY_START} max={DAY_END} step="60" aria-label="Do"
            value={row.to} onChange={e => update(i, { to: e.target.value })} style={{ width: '6.5rem' }} />
          <select className="input-field" aria-label="Dojezd" value={row.custom ? 'custom' : String(row.travelMin)}
            onChange={e => (e.target.value === 'custom'
              ? update(i, { custom: true })
              : update(i, { custom: false, travelMin: Number(e.target.value) }))}
            style={{ width: '7rem' }}>
            {TRAVEL_PRESETS.map(min => <option key={min} value={String(min)}>🕒 {min} min</option>)}
            <option value="custom">Jiný…</option>
          </select>
          {row.custom && (
            <input className="input-field" type="number" min={MIN_TRAVEL} max={MAX_TRAVEL} step="1" aria-label="Dojezd v minutách"
              value={Number.isNaN(row.travelMin) ? '' : row.travelMin}
              onChange={e => update(i, { travelMin: e.target.value === '' ? NaN : Number(e.target.value) })}
              style={{ width: '4.5rem' }} />
          )}
          <button type="button" className="btn" disabled={busy} onClick={() => removeRow(i)} aria-label="Smazat čas"
            style={{ padding: '0.35rem 0.6rem' }}>
            🗑
          </button>
        </div>
      ))}

      {rows.length < MAX_SLOTS && (
        <button type="button" className="btn" disabled={busy} onClick={addRow}
          style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          + Přidat další čas
        </button>
      )}

      {error && <div style={{ color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn btn-primary" disabled={busy || !!error} onClick={() => onSave(slots)}>
          Uložit
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          Zpět
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Day panel**

Create `src/components/dashboard/availability/DayPanel.jsx`:

```jsx
import React, { useState } from 'react';
import { DAY_START, DAY_END, describeCoverage, describePersonTimes, formatDateCZ } from '../../../../shared/availability.js';
import { STATUS_STYLE } from './statusStyle';
import SlotEditor from './SlotEditor';
import TravelPicker from './TravelPicker';

export default function DayPanel({ coverage, readOnly = false, me = null, busy = false, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [askTravel, setAskTravel] = useState(false);
  const style = STATUS_STYLE[coverage.status];

  const saveFullDay = (travelMin) => onSave([{ from: DAY_START, to: DAY_END, travelMin }]);

  const handleQuickAdd = () => {
    if (!me.rememberedTravel) {
      setAskTravel(true);
      return;
    }
    saveFullDay(me.rememberedTravel);
  };

  const handleTravelPicked = async (travelMin) => {
    const ok = await saveFullDay(travelMin);
    if (ok) setAskTravel(false);
  };

  const handleEditorSave = async (slots) => {
    const ok = await onSave(slots);
    if (ok) setEditing(false);
  };

  const handleRemove = async () => {
    const ok = await onRemove();
    if (ok) setEditing(false);
  };

  const renderMine = () => {
    if (me.absent) {
      return <p style={{ color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>Máš absenci</p>;
    }
    if (editing) {
      return (
        <SlotEditor
          initialSlots={me.doc?.slots}
          defaultTravel={me.rememberedTravel}
          busy={busy}
          onSave={handleEditorSave}
          onCancel={() => setEditing(false)}
          onRemove={me.doc ? handleRemove : null}
        />
      );
    }
    if (askTravel) {
      return <TravelPicker busy={busy} onPick={handleTravelPicked} onCancel={() => setAskTravel(false)} />;
    }
    return (
      <div style={{ marginBottom: '0.75rem' }}>
        {me.onDayShift && (
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem' }}>Jsi na denní službě</p>
        )}
        {me.doc ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--success-text)' }}>✓ Jsem k dispozici</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {me.doc.slots.map(s => `${s.from}–${s.to} (${s.travelMin} min)`).join(', ')}
            </span>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setEditing(true)}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
              Změnit čas
            </button>
            <button type="button" className="btn" disabled={busy} onClick={handleRemove}
              style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}>
              Zrušit
            </button>
          </div>
        ) : !me.onDayShift && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleQuickAdd}
              style={{ padding: '0.7rem 1.1rem', fontSize: '1rem', fontWeight: 700 }}>
              Jsem k dispozici ({DAY_START}–{DAY_END})
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setEditing(true)}
              style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}>
              Jiný čas
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{
        padding: '0.6rem 0.8rem', borderRadius: '8px', background: style.bg, color: style.color,
        border: `1px solid ${style.border}`, fontWeight: 700, marginBottom: '0.75rem',
      }}>
        {style.icon} {formatDateCZ(coverage.date)} — {describeCoverage(coverage)}
      </div>

      {!readOnly && me && renderMine()}

      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
        Kdo je k dispozici
      </div>
      {coverage.people.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Zatím nikdo.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {coverage.people.map(p => (
            <li key={p.uid} style={{
              display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap',
              padding: '0.45rem 0', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ color: 'var(--text-primary)' }}>
                <strong>{p.name}</strong>
                <span style={{ color: 'var(--text-secondary)' }}> · {p.primaryRole || '—'}</span>
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {[p.onDayShift ? 'denní služba · na stanici' : null, describePersonTimes(p) || null].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Card container**

Create `src/components/dashboard/availability/AvailabilityCard.jsx`:

```jsx
import React, { useMemo, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useAvailabilityData, useAvailabilityActions } from '../../../hooks/useAvailability';
import { toISODate, addDays, WINDOW_DAYS, computeDayCoverage, isAbsentOn } from '../../../../shared/availability.js';
import DayStrip from './DayStrip';
import DayPanel from './DayPanel';

export default function AvailabilityCard() {
  const { currentUser } = useAuth();
  const todayISO = toISODate(new Date());
  const endISO = addDays(todayISO, WINDOW_DAYS - 1);
  const { loading, availabilityDocs, absences, members, dayShiftsByDate } = useAvailabilityData(todayISO, endISO);
  const { busy, saveDay, removeDay, copyWeek, rememberedTravel } = useAvailabilityActions();
  const [selectedDate, setSelectedDate] = useState(todayISO);

  // Po půlnoci může vybraný den zůstat v minulosti — minulé dny nelze upravovat.
  const activeDate = selectedDate < todayISO || selectedDate > endISO ? todayISO : selectedDate;
  const uid = currentUser?.uid;

  const days = useMemo(() => Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(todayISO, i);
    return computeDayCoverage({ date, members, availabilityDocs, absences, dayShift: dayShiftsByDate[date] });
  }), [todayISO, members, availabilityDocs, absences, dayShiftsByDate]);

  const myAbsentDates = useMemo(
    () => new Set(days.filter(d => isAbsentOn(absences, uid, d.date)).map(d => d.date)),
    [days, absences, uid],
  );

  const selectedCoverage = days.find(d => d.date === activeDate) || days[0];
  const myDoc = availabilityDocs.find(d => d.uid === uid && d.date === activeDate);
  const me = {
    doc: myDoc,
    absent: myAbsentDates.has(activeDate),
    onDayShift: Object.values(dayShiftsByDate[activeDate] || {}).some(s => s?.uid === uid),
    rememberedTravel,
  };

  return (
    <section className="dashboard-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>🚑 Dostupnost k výjezdu</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>2× Hasič · 1× Strojník · 1× Velitel</div>
      </div>

      <DayStrip
        days={days}
        selectedDate={activeDate}
        onSelect={setSelectedDate}
        myUid={uid}
        myAbsentDates={myAbsentDates}
        loading={loading}
      />

      {!loading && (
        <DayPanel
          key={activeDate}
          coverage={selectedCoverage}
          me={me}
          busy={busy}
          onSave={(slots) => saveDay(activeDate, slots, myDoc?.slots)}
          onRemove={() => removeDay(activeDate, myDoc?.slots)}
        />
      )}

      <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy || loading}
          onClick={() => copyWeek({ todayISO, availabilityDocs, absences })}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          Opakovat na další týden
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Render on the dashboard**

In `src/pages/DashboardPage.jsx` add the import after the `WeatherWarnings` import:

```jsx
import AvailabilityCard from '../components/dashboard/availability/AvailabilityCard';
```

And between the closing `</header>` and `{/* Weather Warnings */}`:

```jsx
            {/* Dostupnost k výjezdu — pevně nahoře, mimo přeuspořádatelné widgety */}
            <AvailabilityCard />

```

- [ ] **Step 8: Verify build, lint, tests**

Run: `npm run build` → succeeds.
Run: `npm run lint` → no new errors in the new files or `DashboardPage.jsx`.
Run: `npm test` → PASS.

- [ ] **Step 9: Manual check in the browser**

Run `npm run dev`, log in, open the dashboard (light and dark theme) and verify:
1. Card sits directly under the greeting with 14 tiles, today selected.
2. First "Jsem k dispozici" opens "Za jak dlouho jsi na stanici?"; picking 5 min saves, tile shows `✓ já`, name appears with `🕒 5 min`.
3. "Změnit čas" → add second row 13:00–18:00, set first row to 05:00–10:00 → Uložit → list shows both ranges; overlapping rows with different travel show "Časy se překrývají" and disable Uložit.
4. "Zrušit" removes the entry.
5. "Opakovat na další týden" copies; second click shows "Není co kopírovat".
6. Administrace → Logy → filter 🚑 Dostupnost shows the entries with correct texts.

Note: the rules currently deployed in Firebase still have the old catch-all, which already allows these writes — local testing works before the new rules are deployed.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard/availability src/pages/DashboardPage.jsx
git commit -m "feat(dostupnost): dashboard card with day strip, quick add, slot editor and week copy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Statistics tab

**Files:**
- Create: `src/components/statistics/AvailabilityTab.jsx`
- Modify: `src/pages/StatisticsPage.jsx` (import near line 10; tab button after the `absences` button ending at line ~250; render after the Absences block ending at line ~328)

**Interfaces:**
- Consumes: `useAvailabilityData` (Task 5); `summarizeMonth`, `toISODate`, `CREW_SIZE` (shared); `STATUS_STYLE`, `DayPanel` (Task 6); `StatCard({ icon, value, label, sublabel, color, bg })`; `ChartBlock({ title, height, children })` from `./ChartComponents`.

- [ ] **Step 1: Create the tab**

Create `src/components/statistics/AvailabilityTab.jsx`:

```jsx
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useAvailabilityData } from '../../hooks/useAvailability';
import { summarizeMonth, toISODate, CREW_SIZE } from '../../../shared/availability.js';
import StatCard from './StatCard';
import { ChartBlock } from './ChartComponents';
import DayPanel from '../dashboard/availability/DayPanel';
import { STATUS_STYLE } from '../dashboard/availability/statusStyle';

const WEEKDAYS_MON_FIRST = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
const pad = (n) => String(n).padStart(2, '0');

function MemberTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{row.fullName}</div>
      <div style={{ color: 'var(--text-secondary)' }}>{row.hours} h k dispozici</div>
      {row.avgTravelMin !== null && <div style={{ color: 'var(--text-secondary)' }}>Průměrný dojezd {row.avgTravelMin} min</div>}
    </div>
  );
}

export default function AvailabilityTab({ currentDate }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
  const todayISO = toISODate(new Date());

  const { loading, availabilityDocs, absences, members, dayShiftsByDate } = useAvailabilityData(monthStart, monthEnd);
  const [selectedDate, setSelectedDate] = useState(null);

  const summary = useMemo(
    () => summarizeMonth({ year, month, todayISO, members, availabilityDocs, absences, dayShiftsByDate }),
    [year, month, todayISO, members, availabilityDocs, absences, dayShiftsByDate],
  );

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Načítám dostupnost…</div>;
  }

  if (monthStart > todayISO) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Tento měsíc ještě nezačal.</div>;
  }

  const byDate = new Map(summary.perDay.map(d => [d.date, d]));
  const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const selectedCoverage = selectedDate ? byDate.get(selectedDate) : null;

  const missingData = [
    { name: 'Velitel', dni: summary.missingByPosition.Velitel },
    { name: 'Strojník', dni: summary.missingByPosition['Strojník'] },
    { name: 'Hasič', dni: summary.missingByPosition['Hasič'] },
  ];
  const memberData = summary.memberHours.map(m => ({
    name: m.name.split(' ')[0],
    fullName: m.name,
    hours: m.hours,
    avgTravelMin: m.avgTravelMin,
  }));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <StatCard icon={STATUS_STYLE.complete.icon} value={summary.counts.complete} label="Kompletní dny"
          sublabel={`plná posádka ${CREW_SIZE}/${CREW_SIZE} celý den`} color={STATUS_STYLE.complete.color} bg={STATUS_STYLE.complete.bg} />
        <StatCard icon={STATUS_STYLE.partial.icon} value={summary.counts.partial} label="Částečně"
          sublabel="plná posádka jen část dne" color={STATUS_STYLE.partial.color} bg={STATUS_STYLE.partial.bg} />
        <StatCard icon={STATUS_STYLE.missing.icon} value={summary.counts.missing} label="Chybí"
          sublabel="plná posádka ani chvíli" color={STATUS_STYLE.missing.color} bg={STATUS_STYLE.missing.bg} />
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem', color: 'var(--text-charcoal)' }}>📅 Přehled měsíce</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.3rem' }}>
          {WEEKDAYS_MON_FIRST.map(w => (
            <div key={w} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{w}</div>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}
          {Array.from({ length: lastDay }, (_, i) => {
            const date = `${year}-${pad(month)}-${pad(i + 1)}`;
            const coverage = byDate.get(date);
            const style = coverage ? STATUS_STYLE[coverage.status] : null;
            return (
              <button
                key={date}
                type="button"
                disabled={!coverage}
                onClick={() => setSelectedDate(date)}
                aria-pressed={selectedDate === date}
                style={{
                  padding: '0.45rem 0',
                  borderRadius: '6px',
                  border: `2px solid ${selectedDate === date ? 'var(--text-primary)' : 'transparent'}`,
                  background: style ? style.bg : 'var(--surface-alt)',
                  color: style ? style.color : 'var(--text-muted)',
                  fontWeight: 700,
                  cursor: coverage ? 'pointer' : 'default',
                  opacity: coverage ? 1 : 0.5,
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        {selectedCoverage && (
          <div style={{ marginTop: '1rem' }}>
            <DayPanel key={selectedCoverage.date} coverage={selectedCoverage} readOnly />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        <ChartBlock title="🔍 Nejčastěji chybí (dny)" height={220}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={missingData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-hover)" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => [`${value} dní`, 'Chyběl']} />
              <Bar dataKey="dni" fill="var(--danger)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartBlock>

        {memberData.length > 0 ? (
          <ChartBlock title="🙋 Dostupnost členů (hodiny)" height={Math.max(200, memberData.length * 36 + 40)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} layout="vertical" margin={{ top: 5, right: 24, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-hover)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
                <Tooltip content={<MemberTooltip />} />
                <Bar dataKey="hours" fill="var(--indigo)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>
        ) : (
          <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            V tomto měsíci zatím nikdo nezadal dostupnost.
          </div>
        )}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Počítá se do dneška. Minulé měsíce se vyhodnocují podle aktuálních rolí členů.
      </p>
    </>
  );
}
```

- [ ] **Step 2: Wire the tab into StatisticsPage**

In `src/pages/StatisticsPage.jsx`:

Add the import after `import YearTab …`:

```jsx
import AvailabilityTab from '../components/statistics/AvailabilityTab';
```

Update the `activeTab` comment on line 26 to include `'availability'`:

```jsx
  const [activeTab, setActiveTab] = useState('shifts'); // 'shifts' | 'activities' | 'absences' | 'availability' | 'maintenance' | 'cleaning' | 'year'
```

Insert a new button directly after the `🚫 Nepřítomnost` button:

```jsx
        <button
          onClick={() => setActiveTab('availability')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'availability' ? 'var(--indigo-dark)' : 'transparent',
            color: activeTab === 'availability' ? 'var(--text-on-dark)' : 'var(--text-dim)',
            fontWeight: activeTab === 'availability' ? 700 : 500,
            borderRadius: '8px 8px 0 0',
            cursor: 'pointer',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          🚑 Dostupnost
        </button>
```

Insert after the `{/* Absences Tab */}` block:

```jsx
      {/* Availability Tab */}
      {activeTab === 'availability' && (
        <AvailabilityTab currentDate={currentDate} />
      )}
```

- [ ] **Step 3: Verify build, lint, tests**

Run: `npm run build` → succeeds.
Run: `npm run lint` → no new errors.
Run: `npm test` → PASS.

- [ ] **Step 4: Manual check in the browser**

With `npm run dev`: Statistiky → 🚑 Dostupnost. Verify stat cards, month grid (days after today disabled), clicking a day shows the read-only panel with no buttons, both charts render, member tooltip shows average travel time, next month shows "Tento měsíc ještě nezačal.", dark theme is readable.

- [ ] **Step 5: Commit**

```bash
git add src/components/statistics/AvailabilityTab.jsx src/pages/StatisticsPage.jsx
git commit -m "feat(dostupnost): statistics tab with monthly coverage, missing positions and member hours

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Docs and changelog

**Files:**
- Modify: `README.md` (module table lines ~15 and ~22; collections line ~164)

- [ ] **Step 1: README**

In the module table, replace the Dashboard row with:

```markdown
| **Dashboard** | Dostupnost k výjezdu na 14 dní, nadcházející akce, příští služba, nástěnka, počasí a výstrahy pro Brno, upozornění na nesplněné kvízy |
```

Replace the Statistiky row with:

```markdown
| **Statistiky** | Odpracované hodiny, docházka, aktivita členů a pokrytí posádky k výjezdu v grafech |
```

In the "Datové kolekce" line, insert `availability` after `absences`:

```markdown
`users` · `shifts` · `absences` · `availability` · `trainings` · `trainingTemplates` · `events` · `eventTemplates` · `quizzes` · `quizAnswerKeys` · `quizAttempts` · `maintenanceLogs` · `cleaningLogs` · `bulletinPosts` · `suggestions` · `settings` · `activityLogs` · `pushSubscriptions`
```

- [ ] **Step 2: Changelog (unreleased entry)**

Do **not** edit `src/changelog.js`. Its header says entries are added only together with an `APP_VERSION` bump, and only when the user explicitly asks for a release. Instead, include this prepared entry in the final summary so it can be used at release time:

```js
{
  label: 'Nové funkce',
  changes: [
    'Na dashboardu je nová karta „Dostupnost k výjezdu" — jedním klepnutím se označíte jako k dispozici (05:00–18:00), případně nastavíte vlastní časy a dojezd na stanici. Na 14 dní dopředu je vidět, kdy je kompletní posádka (2× Hasič, 1× Strojník, 1× Velitel) a kdo chybí.',
    'Ve Statistikách přibyla záložka Dostupnost s přehledem pokrytí za měsíc, nejčastěji chybějícími pozicemi a hodinami dostupnosti členů.',
  ],
},
```

- [ ] **Step 3: Final verification**

Run: `npm test` → PASS.
Run: `npm run lint` → no new errors.
Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: mention availability in README modules and collections

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Report to the user**

Summarise: what was built, test/build/lint results, that `firestore.rules` must be deployed in the Firebase console (with the Rules Playground checks from Task 4 Step 4), and the prepared changelog text for the next release.
