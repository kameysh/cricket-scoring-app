import { describe, it, expect } from 'vitest';
import { getInitials, calcSR, calcEcon, dismissalText } from './generateShareCard';

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
