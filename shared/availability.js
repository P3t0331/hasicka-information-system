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
