import { describe, expect, it } from 'vitest';
import { colorUp, suggestColorUp } from '../colorup';
import type { ChipColor, ChipSet } from '../types';

const WHITE: ChipColor = { id: 'w', label: 'White', hex: '#fff', quantity: 200, value: 25 };
const RED: ChipColor = { id: 'r', label: 'Red', hex: '#f00', quantity: 150, value: 100 };
const GREEN: ChipColor = { id: 'g', label: 'Green', hex: '#0f0', quantity: 100, value: 500 };

const SET: ChipSet = { id: 's', name: 't', hasPrintedValues: true, colors: [WHITE, RED, GREEN] };

describe('suggestColorUp', () => {
  it('says nothing while the small chip is still needed', () => {
    expect(suggestColorUp(SET, { smallBlind: 25, bigBlind: 50, ante: 0 })).toBeNull();
  });

  it('flags the small chip once every blind is a multiple of the next one', () => {
    const suggestion = suggestColorUp(SET, { smallBlind: 100, bigBlind: 200, ante: 0 });
    expect(suggestion?.retire.id).toBe('w');
    expect(suggestion?.into.id).toBe('r');
  });

  it('keeps the chip when the ante still needs it', () => {
    expect(suggestColorUp(SET, { smallBlind: 100, bigBlind: 200, ante: 50 })).toBeNull();
  });

  it('has nothing to suggest with one denomination', () => {
    const single = { ...SET, colors: [WHITE] };
    expect(suggestColorUp(single, { smallBlind: 100, bigBlind: 200, ante: 0 })).toBeNull();
  });
});

describe('colorUp', () => {
  it('converts whole amounts and races the remainder', () => {
    const result = colorUp({
      retire: WHITE,
      into: RED,
      // 6 white = 150, 4 white = 100, 2 white = 50, 4 white = 100
      holdings: { a: 6, b: 4, c: 2, d: 4 },
      protectShortStacks: false,
    });

    expect(result.totalRetiredValue).toBe(400);
    // 400 of value converts to exactly 4 red chips, nothing lost.
    expect(result.totalAwardedValue).toBe(400);
    expect(result.valueChangeUnits).toBe(0);
  });

  it('never awards more value than it took off the table', () => {
    const result = colorUp({
      retire: WHITE,
      into: RED,
      holdings: { a: 3, b: 3, c: 3 }, // 225 total, only 2 red chips of that
      protectShortStacks: false,
    });
    expect(result.totalAwardedValue).toBeLessThanOrEqual(result.totalRetiredValue);
    expect(result.totalAwardedValue).toBe(200);
  });

  it('gives the odd chips to the biggest remainders', () => {
    const result = colorUp({
      retire: WHITE,
      into: RED,
      holdings: { big: 7, small: 1 }, // 175 and 25
      protectShortStacks: false,
    });
    const big = result.lines.find((l) => l.playerId === 'big')!;
    const small = result.lines.find((l) => l.playerId === 'small')!;
    expect(big.awarded).toBe(2);
    expect(small.awarded).toBe(0);
  });

  it('keeps a short stack alive when told to', () => {
    const result = colorUp({
      retire: WHITE,
      into: RED,
      holdings: { big: 7, small: 1 },
      protectShortStacks: true,
    });
    const small = result.lines.find((l) => l.playerId === 'small')!;
    expect(small.awarded).toBe(1);
    expect(small.rescued).toBe(true);
    expect(result.valueChangeUnits).toBeGreaterThan(0);
  });

  it('leaves players with nothing out of it', () => {
    const result = colorUp({
      retire: WHITE,
      into: RED,
      holdings: { a: 4, none: 0 },
      protectShortStacks: true,
    });
    expect(result.lines.find((l) => l.playerId === 'none')!.awarded).toBe(0);
  });

  it('refuses to convert into a smaller chip', () => {
    const result = colorUp({
      retire: GREEN,
      into: WHITE,
      holdings: { a: 4 },
      protectShortStacks: false,
    });
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
  });
});
