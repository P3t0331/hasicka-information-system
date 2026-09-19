import { describe, it, expect } from 'vitest';
import {
  toMin,
  getParticipantWindow,
  getParticipantHours,
  formatParticipantTimes,
  validateParticipantTimes,
} from './participantTimes.js';

const act = { time: '09:00', timeEnd: '18:00' };

describe('toMin', () => {
  it('parses HH:MM', () => expect(toMin('10:30')).toBe(630));
  it('returns null for empty/invalid', () => {
    expect(toMin('')).toBeNull();
    expect(toMin(undefined)).toBeNull();
    expect(toMin('xx')).toBeNull();
  });
});

describe('getParticipantWindow', () => {
  it('falls back to activity times', () => {
    expect(getParticipantWindow(act, { uid: 'u' })).toEqual({ start: '09:00', end: '18:00' });
  });
  it('uses own times', () => {
    expect(getParticipantWindow(act, { uid: 'u', from: '10:00', until: '16:00' }))
      .toEqual({ start: '10:00', end: '16:00' });
  });
  it('end is null when activity has no timeEnd and no until', () => {
    expect(getParticipantWindow({ time: '09:00' }, { uid: 'u' })).toEqual({ start: '09:00', end: null });
  });
});

describe('getParticipantHours', () => {
  it('full activity without participant', () => expect(getParticipantHours(act)).toBe(9));
  it('full activity for participant without times', () => expect(getParticipantHours(act, { uid: 'u' })).toBe(9));
  it('only until', () => expect(getParticipantHours(act, { uid: 'u', until: '16:00' })).toBe(7));
  it('only from', () => expect(getParticipantHours(act, { uid: 'u', from: '12:30' })).toBe(5.5));
  it('both', () => expect(getParticipantHours(act, { uid: 'u', from: '10:00', until: '12:00' })).toBe(2));
  it('0 when activity has no timeEnd and no until', () => {
    expect(getParticipantHours({ time: '09:00' }, { uid: 'u' })).toBe(0);
  });
  it('counts until even when activity has no timeEnd', () => {
    expect(getParticipantHours({ time: '09:00' }, { uid: 'u', until: '11:00' })).toBe(2);
  });
  it('spans midnight', () => {
    expect(getParticipantHours({ time: '20:00', timeEnd: '02:00' })).toBe(6);
    expect(getParticipantHours({ time: '20:00', timeEnd: '02:00' }, { uid: 'u', until: '23:00' })).toBe(3);
  });
});

describe('formatParticipantTimes', () => {
  it('null when whole time', () => expect(formatParticipantTimes({ uid: 'u' })).toBeNull());
  it('only from', () => expect(formatParticipantTimes({ from: '10:00' })).toBe('od 10:00'));
  it('only until', () => expect(formatParticipantTimes({ until: '16:00' })).toBe('do 16:00'));
  it('both', () => expect(formatParticipantTimes({ from: '10:00', until: '16:00' })).toBe('10:00–16:00'));
  it('null participant', () => expect(formatParticipantTimes(null)).toBeNull());
});

describe('validateParticipantTimes', () => {
  it('accepts empty (whole time)', () => expect(validateParticipantTimes(act, {})).toBeNull());
  it('accepts valid window', () => {
    expect(validateParticipantTimes(act, { from: '10:00', until: '16:00' })).toBeNull();
  });
  it('rejects from before start', () => {
    expect(validateParticipantTimes(act, { from: '08:00' })).toMatch(/začátkem/);
  });
  it('rejects until after end', () => {
    expect(validateParticipantTimes(act, { until: '19:00' })).toMatch(/po konci/);
  });
  it('rejects from >= until', () => {
    expect(validateParticipantTimes(act, { from: '12:00', until: '12:00' })).toMatch(/dříve/);
  });
  it('rejects invalid format', () => {
    expect(validateParticipantTimes(act, { from: 'abc' })).toMatch(/formát/);
  });
  it('activity without timeEnd: any until after start is fine', () => {
    expect(validateParticipantTimes({ time: '09:00' }, { until: '23:00' })).toBeNull();
  });
  it('midnight-spanning activity: only format is checked', () => {
    expect(validateParticipantTimes({ time: '20:00', timeEnd: '02:00' }, { until: '01:00' })).toBeNull();
  });
});
