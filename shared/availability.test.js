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
  summarizeMonth,
  planWeekCopy,
  buildLogDetail,
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
  });

  it('nevybraný dojezd', () => {
    expect(validateSlots([{ ...ok, travelMin: NaN }])).toBe('Vyberte dojezd na stanici.');
    expect(validateSlots([{ ...ok, travelMin: undefined }])).toBe('Vyberte dojezd na stanici.');
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
