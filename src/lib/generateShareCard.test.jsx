import { describe, it, expect } from 'vitest';
import { getInitials, calcSR, calcEcon, dismissalText, mvpRankMeta, formatCardDate, motmCardHeight } from './generateShareCard';

describe('getInitials', () => {
  it('returns first letter of each word, up to 2', () => {
    expect(getInitials('Kamesh Subramaniam')).toBe('KS');
    expect(getInitials('Dinesh Ravi Virat')).toBe('DR');
  });
  it('handles single name', () => {
    expect(getInitials('Krishna')).toBe('K');
  });
  it('handles null/undefined gracefully', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });
});

describe('calcSR', () => {
  it('calculates strike rate correctly', () => {
    expect(calcSR(50, 40)).toBe('125.0');
    expect(calcSR(0, 10)).toBe('0.0');
  });
  it('returns 0.0 when balls is 0 (no division by zero)', () => {
    expect(calcSR(50, 0)).toBe('0.0');
  });
  it('returns one decimal place', () => {
    expect(calcSR(33, 30)).toBe('110.0');
    expect(calcSR(1, 3)).toBe('33.3');
  });
});

describe('calcEcon', () => {
  it('calculates economy correctly', () => {
    expect(calcEcon(24, 12)).toBe('12.0'); // 24/12*6 = 12
    expect(calcEcon(18, 12)).toBe('9.0');  // 18/12*6 = 9
  });
  it('returns 0.0 when legalBalls is 0 (no division by zero)', () => {
    expect(calcEcon(10, 0)).toBe('0.0');
  });
  it('rounds to one decimal', () => {
    expect(calcEcon(10, 6)).toBe('10.0');
    expect(calcEcon(7, 6)).toBe('7.0');
  });
});

describe('dismissalText', () => {
  it('returns Not Out when no dismissal', () => {
    expect(dismissalText(null)).toBe('Not Out');
    expect(dismissalText(undefined)).toBe('Not Out');
  });
  it('formats bowled', () => {
    expect(dismissalText({ type: 'bowled', bowlerName: 'Rajesh' })).toBe('b Rajesh');
  });
  it('formats caught', () => {
    expect(dismissalText({ type: 'caught', fielderName: 'Gopi', bowlerName: 'Vel' })).toBe('c Gopi b Vel');
  });
  it('formats lbw', () => {
    expect(dismissalText({ type: 'lbw', bowlerName: 'Tarun' })).toBe('lbw b Tarun');
  });
  it('formats run out with fielder', () => {
    expect(dismissalText({ type: 'run_out', fielderName: 'Bala' })).toBe('run out (Bala)');
  });
  it('formats run out without fielder', () => {
    expect(dismissalText({ type: 'run_out' })).toBe('run out');
  });
  it('formats stumped', () => {
    expect(dismissalText({ type: 'stumped', fielderName: 'Krishna', bowlerName: 'Vel' })).toBe('st Krishna b Vel');
  });
  it('formats retired hurt', () => {
    expect(dismissalText({ type: 'retired_hurt' })).toBe('Retired Hurt');
  });
});

describe('mvpRankMeta', () => {
  it('returns the right ordinal for ranks 1–3', () => {
    expect(mvpRankMeta(1).ordinal).toBe('1st');
    expect(mvpRankMeta(2).ordinal).toBe('2nd');
    expect(mvpRankMeta(3).ordinal).toBe('3rd');
  });
  it('gives a distinct title per top-3 rank', () => {
    expect(mvpRankMeta(1).title).toMatch(/MOST VALUABLE/i);
    expect(mvpRankMeta(2).title).toMatch(/RUNNER-UP/i);
    expect(mvpRankMeta(3).title).toMatch(/THIRD/i);
  });
  it('always provides gradient + accent + badge colors', () => {
    for (const r of [1, 2, 3]) {
      const m = mvpRankMeta(r);
      expect(m.gradFrom).toMatch(/^#/);
      expect(m.gradTo).toMatch(/^#/);
      expect(m.accent).toMatch(/^#/);
      expect(m.badgeBg).toMatch(/^#/);
      expect(m.badgeText).toMatch(/^#/);
    }
  });
  it('falls back gracefully for ranks beyond 3', () => {
    expect(mvpRankMeta(7).ordinal).toBe('7th');
    expect(mvpRankMeta(7).title).toBeTruthy();
  });
});

describe('formatCardDate', () => {
  it('formats a date as "D Mon YYYY"', () => {
    expect(formatCardDate(new Date(2026, 5, 27))).toBe('27 Jun 2026'); // month is 0-indexed → 5 = Jun
    expect(formatCardDate(new Date(2025, 0, 1))).toBe('1 Jan 2025');
    expect(formatCardDate(new Date(2024, 11, 31))).toBe('31 Dec 2024');
  });
  it('accepts an ISO string', () => {
    expect(formatCardDate('2026-06-27T00:00:00')).toBe('27 Jun 2026');
  });
  it('returns empty string for an invalid date', () => {
    expect(formatCardDate('not-a-date')).toBe('');
  });
  it('defaults to today when called with no argument', () => {
    const today = new Date();
    expect(formatCardDate()).toBe(formatCardDate(today));
  });
});

describe('motmCardHeight', () => {
  it('returns the minimum height for an empty / tiny breakdown', () => {
    expect(motmCardHeight({ groups: [] })).toBe(1350);
    expect(motmCardHeight(null)).toBe(1350);
  });
  it('grows with the number of groups and line items', () => {
    const small = { groups: [{ title: 'BATTING', items: [{}, {}] }] };                       // 1 group, 2 items
    const big   = { groups: [
      { title: 'BATTING', items: [{}, {}, {}, {}, {}, {}, {}] },
      { title: 'BOWLING', items: [{}, {}, {}] },
      { title: 'FIELDING', items: [{}, {}] },
    ] };                                                                                       // 3 groups, 12 items
    expect(motmCardHeight(big)).toBeGreaterThan(motmCardHeight(small));
    // 800 + 3*58 + 12*98 = 2150
    expect(motmCardHeight(big)).toBe(2150);
  });
});
