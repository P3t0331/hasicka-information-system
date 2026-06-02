function formatICSDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-');
  const [hh, mm] = (timeStr || '00:00').split(':');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function addHoursToDateTime(dateStr, timeStr, hours) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh + hours, mm);
  const pad = n => String(n).padStart(2, '0');
  const newDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const newTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  return { dateStr: newDate, timeStr: newTime };
}

function nextDayDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function escapeICS(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function buildVEVENT({ uid, summary, description, dtstart, dtend }) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSDateTime(new Date().toISOString().split('T')[0], '00:00')}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICS(summary)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeICS(description)}`);
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

export function generateICS(events) {
  const vevents = events.map(buildVEVENT).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hasicka IS//CS',
    'CALSCALE:GREGORIAN',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}

export function downloadICS(icsContent, filename) {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function activityToICSEvent(item, type) {
  const startTime = item.time || '09:00';
  let endDateStr = item.date;
  let endTime;

  if (item.timeEnd) {
    endTime = item.timeEnd;
    // Handle case where timeEnd < time (spans midnight)
    if (endTime < startTime) {
      endDateStr = nextDayDateStr(item.date);
    }
  } else {
    const end = addHoursToDateTime(item.date, startTime, 2);
    endDateStr = end.dateStr;
    endTime = end.timeStr;
  }

  const descParts = [];
  if (item.description) descParts.push(item.description);
  if (item.location) descParts.push(`Místo: ${item.location}`);

  return {
    uid: `${type}-${item.id}@hasicka-is`,
    summary: item.title,
    description: descParts.join('\n'),
    dtstart: formatICSDateTime(item.date, startTime),
    dtend: formatICSDateTime(endDateStr, endTime),
  };
}

const SLOT_ROLE_LABELS = {
  velitel: 'Velitel',
  strojnik: 'Strojník',
  hasic1: 'Hasič',
  hasic2: 'Hasič',
  hasic3: 'Hasič',
  hasic4: 'Hasič',
  hasic5: 'Hasič',
};

export function shiftSlotToICSEvent(year, month, day, section, slotKey, slotData, zalohaConfig) {
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${year}-${pad(month)}-${pad(day)}`;

  let summary, dtstart, dtend;

  if (section === 'nightShift') {
    const startTime = slotData.timeFrom || '18:00';
    const endTime = slotData.timeTo || '05:00';
    summary = 'Noční služba';
    dtstart = formatICSDateTime(dateStr, startTime);
    dtend = formatICSDateTime(nextDayDateStr(dateStr), endTime);
  } else if (section === 'dayShift') {
    const startTime = slotData.timeFrom || '07:00';
    const endTime = slotData.timeTo || '17:00';
    summary = 'Denní služba';
    dtstart = formatICSDateTime(dateStr, startTime);
    dtend = formatICSDateTime(dateStr, endTime);
  } else {
    // zalohaStaz
    const startTime = zalohaConfig?.timeFrom || '08:00';
    const endTime = zalohaConfig?.timeTo || '16:00';
    summary = 'Záloha/stáž';
    dtstart = formatICSDateTime(dateStr, startTime);
    dtend = formatICSDateTime(dateStr, endTime);
  }

  const role = SLOT_ROLE_LABELS[slotKey] || slotKey;

  return {
    uid: `shift-${dateStr}-${section}-${slotKey}@hasicka-is`,
    summary,
    description: `Funkce: ${role}`,
    dtstart,
    dtend,
  };
}
