import { describe, expect, it } from 'vitest';
import { fillExact, fillRemainder, type FillItem } from '../knapsack';

const HOME_SET: FillItem[] = [
  { value: 25, cap: 200 },
  { value: 100, cap: 150 },
  { value: 500, cap: 100 },
  { value: 2500, cap: 50 },
];

function valueOf(counts: number[], items: FillItem[]): number {
  return counts.reduce((sum, n, i) => sum + n * items[i]!.value, 0);
}

describe('fillExact', () => {
  it('hits the target exactly', () => {
    const result = fillExact(2000, HOME_SET, 'min');
    expect(result.exact).toBe(true);
    expect(valueOf(result.counts, HOME_SET)).toBe(2000);
  });

  it('minimises chips when asked to', () => {
    const result = fillExact(6000, HOME_SET, 'min');
    expect(result.exact).toBe(true);
    // 2 x 2500 + 2 x 500 is the fewest chips that make 6000.
    expect(result.counts.reduce((a, b) => a + b)).toBe(4);
  });

  it('maximises chips when asked to', () => {
    const min = fillExact(2000, HOME_SET, 'min');
    const max = fillExact(2000, HOME_SET, 'max');
    expect(max.exact).toBe(true);
    expect(valueOf(max.counts, HOME_SET)).toBe(2000);
    expect(max.counts.reduce((a, b) => a + b)).toBeGreaterThan(
      min.counts.reduce((a, b) => a + b),
    );
    // Every 25c chip available, since that is what "most chips" means.
    expect(max.counts[0]).toBe(80);
  });

  it('respects per-colour caps', () => {
    const tight: FillItem[] = [
      { value: 25, cap: 4 },
      { value: 100, cap: 2 },
      { value: 500, cap: 10 },
    ];
    const result = fillExact(1800, tight, 'max');
    expect(result.exact).toBe(true);
    result.counts.forEach((n, i) => expect(n).toBeLessThanOrEqual(tight[i]!.cap));
  });

  it('reports the closest reachable value when the target is impossible', () => {
    // Nothing here can express the odd 10 cents.
    const result = fillExact(1010, [{ value: 100, cap: 20 }], 'min');
    expect(result.exact).toBe(false);
    expect(result.total).toBe(1000);
  });

  it('fails cleanly when there are not enough chips', () => {
    const result = fillExact(10_000, [{ value: 100, cap: 5 }], 'min');
    expect(result.exact).toBe(false);
    expect(result.total).toBe(500);
  });

  it('handles a large points stack quickly', () => {
    const points: FillItem[] = [
      { value: 25, cap: 500 },
      { value: 100, cap: 500 },
      { value: 500, cap: 300 },
      { value: 1000, cap: 200 },
      { value: 5000, cap: 100 },
    ];
    const started = Date.now();
    const result = fillExact(250_000, points, 'min');
    expect(result.exact).toBe(true);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('treats a zero target as trivially solved', () => {
    expect(fillExact(0, HOME_SET, 'min').exact).toBe(true);
  });
});

describe('fillRemainder', () => {
  it('keeps the preset chips and closes the gap', () => {
    const preset = [24, 0, 0, 0]; // 600 of the target already placed
    const result = fillRemainder(2000, HOME_SET, preset, 'min');
    expect(result).not.toBeNull();
    expect(result!.counts[0]).toBeGreaterThanOrEqual(24);
    expect(valueOf(result!.counts, HOME_SET)).toBe(2000);
  });

  it('returns null when the preset strands an unreachable residual', () => {
    // All the 25s are spent, so 1550 cannot be made from 100s and 500s.
    const items: FillItem[] = [
      { value: 25, cap: 18 },
      { value: 100, cap: 10 },
      { value: 500, cap: 8 },
    ];
    expect(fillRemainder(2000, items, [18, 0, 0], 'min')).toBeNull();
  });

  it('rejects a preset worth more than the target', () => {
    expect(fillRemainder(1000, HOME_SET, [0, 0, 0, 1], 'min')).toBeNull();
  });
});
