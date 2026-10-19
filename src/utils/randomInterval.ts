import type { PauseBounds } from '../types/game';

export const MIN_ALLOWED_SECONDS = 5;
export const MAX_ALLOWED_SECONDS = 600;

/** Draws an integer using crypto.getRandomValues with rejection sampling. */
export function secureRandomInt(min: number, max: number): number {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
    throw new RangeError('Pause timing needs a minimum no greater than its maximum.');
  }
  const range = high - low + 1;
  if (range <= 1) return low;

  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return low + Math.floor(Math.random() * range);

  const span = 0x1_0000_0000;
  const limit = Math.floor(span / range) * range;
  const word = new Uint32Array(1);
  let value: number;
  do {
    cryptoApi.getRandomValues(word);
    value = word[0]!;
  } while (value >= limit);
  return low + (value % range);
}

export function normalizeBounds(bounds: PauseBounds): PauseBounds {
  if (!Number.isFinite(bounds.minSeconds) || !Number.isFinite(bounds.maxSeconds)) {
    throw new RangeError('Pause times must be valid numbers.');
  }
  const minSeconds = Math.min(MAX_ALLOWED_SECONDS, Math.max(MIN_ALLOWED_SECONDS, Math.round(bounds.minSeconds)));
  const maxSeconds = Math.min(MAX_ALLOWED_SECONDS, Math.max(MIN_ALLOWED_SECONDS, Math.round(bounds.maxSeconds)));
  if (minSeconds > maxSeconds) {
    throw new RangeError('The minimum pause time cannot be greater than the maximum.');
  }
  return { minSeconds, maxSeconds };
}

export function choosePauseDuration(bounds: PauseBounds): number {
  const safe = normalizeBounds(bounds);
  return secureRandomInt(safe.minSeconds, safe.maxSeconds);
}
