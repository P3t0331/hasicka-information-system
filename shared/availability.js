// shared/availability.js
//
// Dostupnost členů k výjezdu — veškerá pravidla na jednom místě. Čte je
// dashboard (karta Dostupnost k výjezdu) i Statistiky, takže se oba pohledy
// nemohou rozejít. Bez Firebase, testováno v availability.test.js.

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
