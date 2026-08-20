/**
 * CALCULATION_TEST_SUITE.md — edge, colour-up, and settlement cases.
 */
import { describe, expect, it } from 'vitest';
import { colorUp } from '@/lib/colorup';
import { recommendCashBlinds } from '@/lib/blinds';
import { activeColors } from '@/lib/chips';
import { DOLLAR, Game, STANDARD_SET, settlementClears } from './harness';

const $ = (dollars: number) => Math.round(dollars * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('E — edge and settlement', () => {
  it('E-01 two colours worth the same both count at face value', () => {
    const game = new Game(DOLLAR)
      .chips([
        ['White', 25, 200],
        ['Ivory', 25, 200],
        ['Red', 100, 150],
      ])
      .players([$(20), $(20)])
      .start()
      .counts([{ White: 80 }, { Ivory: 80 }]);

    expect(game.cashouts()).toEqual([$(20), $(20)]);
    expect(game.payout().deltaCents).toBe(0);
  });

  it('E-02 a single denomination pays out and warns the game is coarse', () => {
    const game = new Game(DOLLAR)
      .chips([['Red', 100, 200]])
      .players([$(10), $(10), $(10)])
      .start()
      .totals([$(10), $(10), $(10)]);

    expect(game.cashouts()).toEqual([$(10), $(10), $(10)]);

    const rec = recommendCashBlinds({
      stackUnits: $(10),
      depthTargetBB: 50,
      denominations: [100],
    });
    // A $1 minimum chip against a $10 stack cannot reach 50BB, so it must say so.
    expect(rec.notices.length).toBeGreaterThan(0);
  });

  it('E-03 a colour with no chips is left out of the count', () => {
    const game = new Game(DOLLAR)
      .chips([
        ['White', 25, 200],
        ['Red', 100, 150],
        ['Green', 500, 0],
      ])
      .players([$(20), $(20)])
      .start();

    // A zero-quantity colour is not part of the working set.
    expect(activeColors(game.state.chipSet).map((c) => c.label)).not.toContain('Green');

    game.counts([
      { White: 20, Red: 5 },
      { White: 20, Red: 5 },
    ]);
    expect(game.cashouts()).toEqual([$(10), $(10)]);
  });

  it('E-04 a four-figure amount survives parsing and counting exactly', () => {
    const game = new Game(DOLLAR)
      .chips([['White', 1, 200000]])
      .players([$(1234.56)])
      .start()
      .totals([123456]);

    expect(game.payout().countedCents).toBe($(1234.56));
    expect(game.cashouts()).toEqual([$(1234.56)]);
  });

  it('E-05a a clean colour-up converts four 25c chips into one $1 chip', () => {
    const retire = { id: 'w', label: 'White', hex: '#fff', quantity: 200, value: 25 };
    const into = { id: 'r', label: 'Red', hex: '#f00', quantity: 150, value: 100 };
    const result = colorUp({
      retire,
      into,
      holdings: { a: 4, b: 4 },
      protectShortStacks: false,
    });

    expect(result.lines.map((l) => l.awarded)).toEqual([1, 1]);
    expect(result.valueChangeUnits).toBe(0);
    expect(result.totalAwardedValue).toBe(result.totalRetiredValue);
  });

  it('E-05b an unprotected race conserves the value on the table exactly', () => {
    const retire = { id: 'w', label: 'White', hex: '#fff', quantity: 200, value: 25 };
    const into = { id: 'r', label: 'Red', hex: '#f00', quantity: 150, value: 100 };
    const result = colorUp({
      retire,
      into,
      holdings: { a: 7, b: 1 },
      protectShortStacks: false,
    });

    // 8 chips at 25c is $2, which is exactly two $1 chips. Nothing may be created.
    expect(result.totalRetiredValue).toBe(200);
    expect(result.totalAwardedValue).toBe(200);
    expect(result.valueChangeUnits).toBe(0);
    expect(sum(result.lines.map((l) => l.awarded))).toBe(2);
  });

  it('E-05c protecting a short stack creates value and says so', () => {
    const retire = { id: 'w', label: 'White', hex: '#fff', quantity: 200, value: 25 };
    const into = { id: 'r', label: 'Red', hex: '#f00', quantity: 150, value: 100 };
    const result = colorUp({
      retire,
      into,
      holdings: { a: 7, b: 1 },
      protectShortStacks: true,
    });

    // b is rescued with a chip they did not earn, so the table gains value.
    expect(result.valueChangeUnits).toBeGreaterThan(0);
    expect(result.notices.length).toBeGreaterThan(0);
  });

  it('E-05d a protected race shows up at payout as a real discrepancy', () => {
    // The table now holds $41 against a $40 pot. Both resolutions stay honest.
    const scaled = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players([$(20), $(20)])
      .start()
      .totals([$(21), $(20)])
      .resolution('scale');
    expect(scaled.payout().countedCents).toBe($(41));
    expect(scaled.payout().potCents).toBe($(40));
    expect(scaled.cashouts()).toEqual([$(20.49), $(19.51)]);
    expect(sum(scaled.cashouts())).toBe($(40));

    const accepted = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players([$(20), $(20)])
      .start()
      .totals([$(21), $(20)])
      .resolution('accept');
    expect(accepted.cashouts()).toEqual([$(21), $(20)]);
    expect(accepted.payout().notices.some((n) => n.level === 'warn')).toBe(true);
  });

  it('E-06 five players settle in two transfers that conserve every cent', () => {
    const game = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players(Array(5).fill($(20)))
      .start()
      .totals([$(5), $(15), $(20), $(25), $(35)]);

    expect(game.cashouts()).toEqual([$(5), $(15), $(20), $(25), $(35)]);

    const { transfers } = game.payout();
    expect(transfers).toEqual([
      { fromPlayerId: game.id(0), toPlayerId: game.id(4), cents: $(15) },
      { fromPlayerId: game.id(1), toPlayerId: game.id(3), cents: $(5) },
    ]);
    expect(settlementClears(game.payout())).toBe(true);
  });
});
