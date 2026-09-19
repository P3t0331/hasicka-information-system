//
// Částečná účast člena na akci/školení („jen do 16:00", „přijdu v 10:00").
// Účastník v poli `participants` může mít volitelné `from`/`until` ('HH:MM');
// chybějící hodnota znamená začátek/konec akce. Čte to UI karet i Statistiky,
// takže se výpočty nemohou rozejít. Bez Firebase.

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function toMin(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const m = TIME_RE.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function getParticipantWindow(activity, participant) {
  return {
    start: participant?.from || activity?.time || null,
    end: participant?.until || activity?.timeEnd || null,
  };
}

export function getParticipantHours(activity, participant) {
  const { start, end } = getParticipantWindow(activity, participant);
  const s = toMin(start);
  const e = toMin(end);
  if (s === null || e === null) return 0;
  const diff = e - s;
  if (diff < 0) {
    const actStart = toMin(activity?.time);
    const actEnd = toMin(activity?.timeEnd);
    const activitySpansMidnight = actStart !== null && actEnd !== null && actEnd < actStart;
    if (activitySpansMidnight) return (diff + 24 * 60) / 60; // přes půlnoc
    return 0;
  }
  return diff / 60;
}

export function formatParticipantTimes(participant) {
  const from = participant?.from;
  const until = participant?.until;
  if (from && until) return `${from}–${until}`;
  if (from) return `od ${from}`;
  if (until) return `do ${until}`;
  return null;
}

export function validateParticipantTimes(activity, { from, until } = {}) {
  if (from && toMin(from) === null) return 'Neplatný formát času příchodu.';
  if (until && toMin(until) === null) return 'Neplatný formát času odchodu.';

  const start = toMin(activity?.time);
  const end = toMin(activity?.timeEnd);
  // Akce přes půlnoc — pořadí časů nelze spolehlivě porovnat, kontrolujeme jen formát.
  if (start !== null && end !== null && end < start) return null;

  const f = toMin(from);
  const u = toMin(until);
  if (f !== null && start !== null && f < start) return `Příchod nemůže být před začátkem akce (${activity.time}).`;
  if (u !== null && end !== null && u > end) return `Odchod nemůže být po konci akce (${activity.timeEnd}).`;
  if (u !== null && start !== null && u <= start) return `Odchod musí být po začátku akce (${activity.time}).`;
  if (f !== null && end !== null && f >= end) return `Příchod musí být před koncem akce (${activity.timeEnd}).`;
  if (f !== null && u !== null && f >= u) return 'Příchod musí být dříve než odchod.';
  return null;
}
