import { describe, expect, it } from 'vitest';
import { countChips, countUnits } from '../chips';
import { distribute, rebuyStack, standardStack } from '../distribution';
import type { ChipSet, DistributionMode } from '../types';

const CHIP_SET: ChipSet = {
  id: 'set',
  name: 'test',
  hasPrintedValues: true,
  colors: [
    { id: 'w', label: 'White', hex: '#fff', quantity: 200, value: 25 },
    { id: 'r', label: 'Red', hex: '#f00', quantity: 150, value: 100 },
    { id: 'g', label: 'Green', hex: '#0f0', quantity: 100, value: 500 },
    { id: 'b', label: 'Black', hex: '#000', quantity: 50, value: 2500 },
  ],
};

const evenTable = (count: number, target = 2000) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i}`, targetUnits: target }));

const MODES: DistributionMode[] = ['balanced', 'efficient', 'deep'];

describe('distribute', () => {
  it.each(MODES)('makes every stack worth exactly the buy-in (%s)', (mode) => {
    const result = distribute({
      chipSet: CHIP_SET,
      players: evenTable(6),
      mode,
      reserveStacks: 2,
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.feasible).toBe(true);
    for (const stack of result.stacks) {
      expect(stack.exact).toBe(true);
      expect(countUnits(stack.counts, CHIP_SET)).toBe(2000);
    }
  });

  it('never hands out more chips than the host owns', () => {
    const result = distribute({
      chipSet: CHIP_SET,
      players: evenTable(8),
      mode: 'deep',
      reserveStacks: 3,
      smallBlind: 25,
      bigBlind: 50,
    });
    for (const color of CHIP_SET.colors) {
      const dealt = result.stacks.reduce((sum, s) => sum + (s.counts[color.id] ?? 0), 0);
      const held = result.reserve[color.id] ?? 0;
      const left = result.leftover[color.id] ?? 0;
      expect(dealt + held + left).toBe(color.quantity);
    }
  });

  it('orders the profiles by how many chips they use', () => {
    const chips = (mode: DistributionMode) =>
      distribute({
        chipSet: CHIP_SET,
        players: evenTable(4),
        mode,
        reserveStacks: 1,
        smallBlind: 25,
        bigBlind: 50,
      }).stacks[0]!.chipCount;

    expect(chips('efficient')).toBeLessThan(chips('balanced'));
    expect(chips('balanced')).toBeLessThanOrEqual(chips('deep'));
  });

  it('gives even the lean profile enough small chips to post blinds', () => {
    for (const mode of MODES) {
      const result = distribute({
        chipSet: CHIP_SET,
        players: evenTable(6),
        mode,
        reserveStacks: 2,
        smallBlind: 25,
        bigBlind: 50,
      });
      // At least a few orbits of blinds without breaking a bigger chip.
      expect(result.stacks[0]!.counts['w'] ?? 0).toBeGreaterThanOrEqual(8);
    }
  });

  it('handles uneven buy-ins without starving the small stacks', () => {
    const result = distribute({
      chipSet: CHIP_SET,
      players: [
        { id: 'a', targetUnits: 2000 },
        { id: 'b', targetUnits: 2000 },
        { id: 'c', targetUnits: 4000 },
        { id: 'd', targetUnits: 2000 },
        { id: 'e', targetUnits: 6000 },
      ],
      mode: 'balanced',
      reserveStacks: 3,
      smallBlind: 25,
      bigBlind: 50,
    });

    expect(result.feasible).toBe(true);
    for (const stack of result.stacks) {
      expect(countUnits(stack.counts, CHIP_SET)).toBe(stack.targetUnits);
      expect(stack.counts['w'] ?? 0).toBeGreaterThanOrEqual(8);
    }
  });

  it('holds back the reserve it was asked for', () => {
    const result = distribute({
      chipSet: CHIP_SET,
      players: evenTable(4),
      mode: 'balanced',
      reserveStacks: 3,
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.reserveStacks).toBe(3);
    expect(countUnits(result.reserve, CHIP_SET)).toBe(6000);
  });

  it('says so when the chips cannot cover the table', () => {
    const thin: ChipSet = {
      ...CHIP_SET,
      colors: [{ id: 'w', label: 'White', hex: '#fff', quantity: 20, value: 25 }],
    };
    const result = distribute({
      chipSet: thin,
      players: evenTable(6),
      mode: 'balanced',
      reserveStacks: 0,
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.feasible).toBe(false);
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('warns rather than silently skipping an impossible reserve', () => {
    // 109 stacks of $20 is $2,180 of chips; the box only holds $1,950.
    const result = distribute({
      chipSet: CHIP_SET,
      players: evenTable(9),
      mode: 'balanced',
      reserveStacks: 100,
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.reserveStacks).toBeLessThan(100);
    expect(result.notices.some((n) => n.level === 'warn')).toBe(true);
  });

  it('refuses to build a stack from nothing', () => {
    const result = distribute({
      chipSet: { ...CHIP_SET, colors: [] },
      players: evenTable(2),
      mode: 'balanced',
      reserveStacks: 0,
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.feasible).toBe(false);
    expect(result.stacks).toHaveLength(0);
  });
});

describe('standardStack', () => {
  it('picks the buy-in most people are using', () => {
    expect(standardStack([2000, 2000, 4000, 2000, 6000])).toBe(2000);
  });

  it('breaks a tie toward the smaller stack', () => {
    expect(standardStack([2000, 4000])).toBe(2000);
  });
});

describe('rebuyStack', () => {
  it('builds a rebuy from what is left in the box', () => {
    const handedOut = { w: 190, r: 140, g: 90, b: 45 };
    const result = rebuyStack({
      chipSet: CHIP_SET,
      alreadyHandedOut: handedOut,
      targetUnits: 2000,
      mode: 'balanced',
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.exact).toBe(true);
    expect(countUnits(result.counts, CHIP_SET)).toBe(2000);
    for (const color of CHIP_SET.colors) {
      const taken = result.counts[color.id] ?? 0;
      expect(taken).toBeLessThanOrEqual(color.quantity - (handedOut as Record<string, number>)[color.id]!);
    }
  });

  it('reports failure when the box is empty', () => {
    const result = rebuyStack({
      chipSet: CHIP_SET,
      alreadyHandedOut: { w: 200, r: 150, g: 100, b: 50 },
      targetUnits: 2000,
      mode: 'balanced',
      smallBlind: 25,
      bigBlind: 50,
    });
    expect(result.exact).toBe(false);
    expect(countChips(result.counts)).toBe(0);
  });
});
