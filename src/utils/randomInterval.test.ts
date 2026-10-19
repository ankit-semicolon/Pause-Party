import { describe, expect, it } from 'vitest';
import { choosePauseDuration, normalizeBounds, secureRandomInt } from './randomInterval';

describe('random pause timing', () => {
  it('keeps every selected default interval inside 20–75 seconds', () => {
    const samples = Array.from({ length: 250 }, () => choosePauseDuration({ minSeconds: 20, maxSeconds: 75 }));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...samples)).toBeLessThanOrEqual(75);
    expect(new Set(samples).size).toBeGreaterThan(10);
  });

  it('includes both configured endpoints and handles a single-value interval', () => {
    expect(secureRandomInt(12, 12)).toBe(12);
    for (let count = 0; count < 80; count += 1) expect(secureRandomInt(5, 9)).toBeGreaterThanOrEqual(5);
    for (let count = 0; count < 80; count += 1) expect(secureRandomInt(5, 9)).toBeLessThanOrEqual(9);
  });

  it('clamps values to supported timing bounds and rejects invalid ranges', () => {
    expect(normalizeBounds({ minSeconds: 1, maxSeconds: 900 })).toEqual({ minSeconds: 5, maxSeconds: 600 });
    expect(() => normalizeBounds({ minSeconds: 31, maxSeconds: 20 })).toThrow(/minimum/i);
    expect(() => normalizeBounds({ minSeconds: Number.NaN, maxSeconds: 40 })).toThrow(/valid numbers/i);
  });
});
