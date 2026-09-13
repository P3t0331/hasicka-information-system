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
  computeDayCoverage,
  describeCoverage,
  describePersonTimes,
  getPrimaryRole,
  isAbsentOn,
  CREW_SIZE,
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
