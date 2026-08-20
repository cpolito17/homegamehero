import { describe, expect, it } from 'vitest';
import {
  allocateProportional,
  centsToUnits,
  formatMoney,
  formatSigned,
  gcdAll,
  parseMoney,
  parseUnits,
  unitsToCents,
} from '../money';

describe('formatMoney', () => {
  it('drops cents when they are zero', () => {
    expect(formatMoney(2000)).toBe('$20');
    expect(formatMoney(2050)).toBe('$20.50');
    expect(formatMoney(2005)).toBe('$20.05');
  });

  it('groups thousands and handles negatives', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoney(-500)).toBe('-$5');
    expect(formatSigned(500)).toBe('+$5');
    expect(formatSigned(0)).toBe('$0');
  });
});

describe('parseMoney', () => {
  it('accepts the ways people actually type money', () => {
    expect(parseMoney('20')).toBe(2000);
    expect(parseMoney('$20.50')).toBe(2050);
    expect(parseMoney('1,200')).toBe(120000);
    expect(parseMoney(' 7.5 ')).toBe(750);
  });

  it('rejects junk instead of reading it as zero', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('1.2.3')).toBeNull();
  });
});

describe('chip scale', () => {
  it('treats a unit as a cent in dollar mode', () => {
    expect(unitsToCents(2000, { kind: 'dollar' })).toBe(2000);
    expect(centsToUnits(2000, { kind: 'dollar' })).toBe(2000);
  });

  it('converts points through the buy-in rate', () => {
    const scale = { kind: 'points', unitsPerDollar: 50 } as const;
    expect(unitsToCents(1000, scale)).toBe(2000); // 1000 pts = $20
    expect(centsToUnits(2000, scale)).toBe(1000);
  });

  it('parses points as whole numbers only', () => {
    const scale = { kind: 'points', unitsPerDollar: 50 } as const;
    expect(parseUnits('1,000', scale)).toBe(1000);
    expect(parseUnits('10.5', scale)).toBeNull();
  });
});

describe('allocateProportional', () => {
  it('always sums to the total', () => {
    expect(allocateProportional(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportional(1000, [50, 30, 20]).reduce((a, b) => a + b)).toBe(1000);
  });

  it('gives the leftover to whoever was rounded down hardest', () => {
    // 10 split three ways: 3.33 each, so the first two get the spare units.
    const out = allocateProportional(10, [1, 1, 1]);
    expect(out.reduce((a, b) => a + b)).toBe(10);
    expect(Math.max(...out) - Math.min(...out)).toBe(1);
  });

  it('allocates nothing when there is no weight to split on', () => {
    // Handing it all to the first slot would name a winner out of an empty count.
    expect(allocateProportional(500, [0, 0])).toEqual([0, 0]);
    expect(allocateProportional(0, [3, 7])).toEqual([0, 0]);
  });

  it('never leaves a cent behind on an awkward split', () => {
    for (const total of [997, 1001, 3333, 12345]) {
      const out = allocateProportional(total, [37, 21, 19, 13, 10]);
      expect(out.reduce((a, b) => a + b)).toBe(total);
    }
  });
});

describe('gcdAll', () => {
  it('finds the common factor of a chip ladder', () => {
    expect(gcdAll([25, 100, 500, 2500])).toBe(25);
    expect(gcdAll([5, 7])).toBe(1);
  });
});
