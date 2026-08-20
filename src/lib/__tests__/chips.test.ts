import { describe, expect, it } from 'vitest';
import { assignValues, checkFeasibility, countUnits, ladderSliceFor } from '../chips';
import type { ChipSet } from '../types';

const DOLLAR = { kind: 'dollar' } as const;

const blankSet = (): ChipSet => ({
  id: 'set',
  name: 'blanks',
  hasPrintedValues: false,
  colors: [
    { id: 'a', label: 'Blue', hex: '#00f', quantity: 60, value: null },
    { id: 'b', label: 'White', hex: '#fff', quantity: 200, value: null },
    { id: 'c', label: 'Red', hex: '#f00', quantity: 120, value: null },
  ],
});

describe('ladderSliceFor', () => {
  it('sizes the ladder to the stack', () => {
    const slice = ladderSliceFor(2000, 3, DOLLAR);
    expect(slice).toHaveLength(3);
    expect(slice[0]).toBeLessThanOrEqual(2000 / 20);
    expect(slice[slice.length - 1]).toBeLessThanOrEqual(2000);
  });

  it('returns ascending values', () => {
    const slice = ladderSliceFor(10_000, 4, DOLLAR);
    for (let i = 1; i < slice.length; i++) expect(slice[i]!).toBeGreaterThan(slice[i - 1]!);
  });

  it('has nothing to say without a stack', () => {
    expect(ladderSliceFor(0, 3, DOLLAR)).toEqual([]);
  });
});

describe('assignValues', () => {
  it('gives the smallest value to the colour there is most of', () => {
    const { colors } = assignValues(blankSet(), {
      strategy: 'quantity',
      stackUnits: 2000,
      scale: DOLLAR,
    });
    const byId = Object.fromEntries(colors.map((c) => [c.id, c.value]));
    // White (200) < Red (120) < Blue (60) in value, because that is the quantity order.
    expect(byId['b']!).toBeLessThan(byId['c']!);
    expect(byId['c']!).toBeLessThan(byId['a']!);
  });

  it('skips colours the host owns none of', () => {
    const set = blankSet();
    set.colors[0]!.quantity = 0;
    const { colors, notices } = assignValues(set, {
      strategy: 'quantity',
      stackUnits: 2000,
      scale: DOLLAR,
    });
    expect(colors.find((c) => c.id === 'a')!.value).toBeNull();
    expect(notices.length).toBeGreaterThan(0);
  });

  it('uses casino convention when asked', () => {
    const { colors } = assignValues(blankSet(), {
      strategy: 'convention',
      stackUnits: 2000,
      scale: DOLLAR,
    });
    const byId = Object.fromEntries(colors.map((c) => [c.id, c.value]));
    expect(byId['b']).toBe(100); // white = $1
    expect(byId['c']).toBe(500); // red = $5
    expect(byId['a']).toBe(1000); // blue = $10
  });

  it('leaves printed values alone and fills around them', () => {
    const set = blankSet();
    set.colors[1]!.value = 25; // white is printed 25c
    const { colors } = assignValues(set, {
      strategy: 'quantity',
      stackUnits: 2000,
      scale: DOLLAR,
      onlyBlank: true,
    });
    const byId = Object.fromEntries(colors.map((c) => [c.id, c.value]));
    expect(byId['b']).toBe(25);
    expect(byId['a']).not.toBe(25);
    expect(byId['c']).not.toBe(25);
  });

  it('says something useful when there is nothing to work with', () => {
    const empty = { ...blankSet(), colors: [] };
    const { notices } = assignValues(empty, {
      strategy: 'quantity',
      stackUnits: 2000,
      scale: DOLLAR,
    });
    expect(notices.some((n) => n.level === 'warn')).toBe(true);
  });
});

describe('checkFeasibility', () => {
  const priced: ChipSet = {
    id: 's',
    name: 'p',
    hasPrintedValues: true,
    colors: [
      { id: 'w', label: 'White', hex: '#fff', quantity: 100, value: 25 },
      { id: 'r', label: 'Red', hex: '#f00', quantity: 100, value: 100 },
    ],
  };

  it('is quiet when everything fits', () => {
    const notices = checkFeasibility({
      chipSet: priced,
      requiredUnits: 8000,
      stackTargets: [2000, 2000, 2000, 2000],
      smallBlind: 25,
      playerCount: 4,
    });
    expect(notices.filter((n) => n.level === 'error')).toHaveLength(0);
  });

  it('catches a table worth more than the chips', () => {
    const notices = checkFeasibility({
      chipSet: priced,
      requiredUnits: 100_000,
      stackTargets: [100_000],
      smallBlind: 25,
      playerCount: 1,
    });
    expect(notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('catches a buy-in the chips cannot express', () => {
    const notices = checkFeasibility({
      chipSet: priced,
      requiredUnits: 2010,
      stackTargets: [2010],
      smallBlind: 25,
      playerCount: 1,
    });
    expect(notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('catches an unpostable small blind', () => {
    const notices = checkFeasibility({
      chipSet: priced,
      requiredUnits: 2000,
      stackTargets: [2000],
      smallBlind: 10,
      playerCount: 1,
    });
    expect(notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('warns when stacks would be too few chips to bet with', () => {
    const notices = checkFeasibility({
      chipSet: priced,
      requiredUnits: 2000,
      stackTargets: [2000],
      smallBlind: 25,
      playerCount: 20,
    });
    expect(notices.some((n) => n.level === 'warn')).toBe(true);
  });
});

describe('countUnits', () => {
  it('ignores colours with no value', () => {
    const set = blankSet();
    set.colors[0]!.value = 100;
    expect(countUnits({ a: 3, b: 5 }, set)).toBe(300);
  });
});
