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
