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
