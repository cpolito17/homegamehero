/**
 * Money and chip-unit arithmetic.
 *
 * Two rules hold everywhere in this app:
 *   1. Money is an integer number of cents. Floats never touch a dollar amount.
 *   2. "Chip units" are whatever is printed on the chip — cents in dollar mode,
 *      abstract points in points mode. Conversion to cents happens at exactly one
 *      boundary (`unitsToCents`) so the rest of the code never has to care.
 */

export type ChipScale =
  | { kind: 'dollar' }
  | { kind: 'points'; unitsPerDollar: number };

export const DOLLAR_SCALE: ChipScale = { kind: 'dollar' };

/** Chip units -> cents. In dollar mode a unit *is* a cent. */
export function unitsToCents(units: number, scale: ChipScale): number {
  if (scale.kind === 'dollar') return Math.round(units);
  if (scale.unitsPerDollar <= 0) return 0;
  return Math.round((units * 100) / scale.unitsPerDollar);
}

/** Cents -> chip units. Rounds; callers that need exactness should check the round-trip. */
export function centsToUnits(cents: number, scale: ChipScale): number {
  if (scale.kind === 'dollar') return Math.round(cents);
  return Math.round((cents * scale.unitsPerDollar) / 100);
}

export function formatMoney(cents: number, opts: { cents?: 'auto' | 'always' } = {}): string {
  const mode = opts.cents ?? 'auto';
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const body =
    mode === 'always' || frac !== 0
      ? `${whole.toLocaleString('en-US')}.${String(frac).padStart(2, '0')}`
      : whole.toLocaleString('en-US');
  return `${neg ? '-' : ''}$${body}`;
}

/** Signed money, always with an explicit + or -. Used for net win/loss. */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatMoney(0);
  return (cents > 0 ? '+' : '') + formatMoney(cents);
}

export function formatUnits(units: number, scale: ChipScale): string {
  if (scale.kind === 'dollar') return formatMoney(units);
  return Math.round(units).toLocaleString('en-US');
}

/**
 * Parses user money input. Accepts "12", "$12.50", "12.5", "1,200".
 * Returns null for anything that is not a clean number so callers can keep the
 * field in an error state rather than silently reading it as zero.
 */
export function parseMoney(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function parseUnits(input: string, scale: ChipScale): number | null {
  if (scale.kind === 'dollar') return parseMoney(input);
  const cleaned = input.trim().replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseCount(input: string): number | null {
  const cleaned = input.trim().replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

export function gcdAll(values: number[]): number {
  return values.reduce((acc, v) => gcd(acc, v), 0);
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Splits an integer `total` across `weights` so the parts sum to exactly `total`.
 *
 * Uses the largest-remainder method: floor everything, then hand the leftover
 * units out one at a time to whoever was rounded down hardest. This is what keeps
 * scaled payouts and prize splits from being a dollar off.
 */
export function allocateProportional(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // No signal to split on: give it all to the first slot rather than inventing a spread.
    const out = new Array<number>(n).fill(0);
    out[0] = total;
    return out;
  }

  const exact = weights.map((w) => (total * w) / sum);
  const floors = exact.map(Math.floor);
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  const out = floors.slice();
  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    out[order[i]!.index]! += 1;
  }
  // Negative totals (or float dust) can leave a deficit; claw it back the same way.
  for (let i = order.length - 1; remainder < 0 && i >= 0; i--, remainder++) {
    out[order[i]!.index]! -= 1;
  }
  return out;
}

/** Rounds to the nearest multiple of `increment`, ties away from zero. */
export function roundToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

export function ceilToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.ceil(value / increment) * increment;
}

let idCounter = 0;
export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${(idCounter++).toString(36)}`;
}
