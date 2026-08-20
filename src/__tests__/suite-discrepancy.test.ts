/**
 * CALCULATION_TEST_SUITE.md — discrepancy, scaling, and conversion cases.
 * Scaled payouts must sum to the pot exactly; counted payouts to the count.
 */
import { describe, expect, it } from 'vitest';
import { DOLLAR, FINE_SET, Game, POINTS_SET, STANDARD_SET, points } from './harness';

const $ = (dollars: number) => Math.round(dollars * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** D-01..D-05 share this table: $20, $20, $20, $40 for a $100 pot. */
const table = () =>
  new Game(DOLLAR).chips(STANDARD_SET).players([$(20), $(20), $(20), $(40)]).start();

describe('D — discrepancy and conversion', () => {
  it('D-01 an undercount with Recount selected refuses to settle', () => {
    const game = table().totals([$(30), $(20), $(20), $(20)]).resolution('none');
    const result = game.payout();

    expect(result.potCents).toBe($(100));
    expect(result.countedCents).toBe($(90));
    expect(result.deltaCents).toBe($(-10));
    // The host has not chosen how to resolve it, so this must read as an error.
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('D-02 the same undercount scaled to the pot pays exactly $100', () => {
    const game = table().totals([$(30), $(20), $(20), $(20)]).resolution('scale');
    expect(game.cashouts()).toEqual([$(33.34), $(22.22), $(22.22), $(22.22)]);
    expect(sum(game.cashouts())).toBe($(100));
  });

  it('D-03 the same undercount paid as counted pays $90 and warns', () => {
    const game = table().totals([$(30), $(20), $(20), $(20)]).resolution('accept');
    expect(game.cashouts()).toEqual([$(30), $(20), $(20), $(20)]);
    expect(sum(game.cashouts())).toBe($(90));
    expect(game.payout().notices.some((n) => n.level === 'warn')).toBe(true);
  });

  it('D-04 an overcount scaled to the pot pays exactly $100', () => {
    const game = table().totals([$(40), $(30), $(20), $(20)]).resolution('scale');
    expect(game.payout().countedCents).toBe($(110));
    expect(game.cashouts()).toEqual([$(36.37), $(27.27), $(18.18), $(18.18)]);
    expect(sum(game.cashouts())).toBe($(100));
  });

  it('D-05 an overcount paid as counted pays $110 and warns', () => {
    const game = table().totals([$(40), $(30), $(20), $(20)]).resolution('accept');
    expect(game.cashouts()).toEqual([$(40), $(30), $(20), $(20)]);
    expect(sum(game.cashouts())).toBe($(110));
    expect(game.payout().notices.some((n) => n.level === 'warn')).toBe(true);
  });

  it('D-06 largest-remainder allocation leaves no stray cent', () => {
    const game = new Game(DOLLAR)
      .chips(FINE_SET)
      .players([$(5), $(5), $(5)])
      .start()
      .totals([$(3.33), $(3.33), $(3.34)])
      .resolution('scale');

    expect(game.cashouts()).toEqual([$(5.0), $(4.99), $(5.01)]);
    expect(sum(game.cashouts())).toBe($(15));
  });

  it('D-07 points convert exactly at 50 points per dollar', () => {
    const game = new Game(points(50))
      .chips(POINTS_SET)
      .players([$(20), $(20)])
      .start()
      .totals([1500, 500]);

    expect(game.payout().countedCents).toBe($(40));
    expect(game.cashouts()).toEqual([$(30), $(10)]);
    expect(game.payout().deltaCents).toBe(0);
  });

  it('D-08 points that do not divide evenly still pay the pot exactly', () => {
    const game = new Game(points(3))
      .chips([['White', 1, 500]])
      .players([$(0.34), $(0.33), $(0.33)])
      .start()
      .totals([1, 1, 1]);

    const result = game.payout();
    expect(result.potCents).toBe($(1));
    expect(result.countedCents).toBe($(1));
    expect(game.cashouts()).toEqual([$(0.34), $(0.33), $(0.33)]);
    expect(sum(game.cashouts())).toBe($(1));
  });

  it('D-09 counting by colour and entering a total give the same answer', () => {
    const byColour = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players([$(20), $(20)])
      .start()
      .counts([
        { White: 4, Red: 5, Green: 2 },
        { Red: 4, Green: 4 },
      ]);
    expect(byColour.cashouts()).toEqual([$(16), $(24)]);

    const byTotal = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players([$(20), $(20)])
      .start()
      .totals([1600, 2400]);
    expect(byTotal.cashouts()).toEqual(byColour.cashouts());
  });

  it('D-10a an all-zero count against a live pot stays unresolved, never settled', () => {
    const game = table().totals([0, 0, 0, 0]).resolution('none');
    const result = game.payout();

    expect(result.countedCents).toBe(0);
    expect(result.deltaCents).toBe($(-100));
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
    expect(result.lines.every((l) => Number.isFinite(l.payoutCents))).toBe(true);
    expect(result.lines.every((l) => l.payoutCents === 0)).toBe(true);
  });

  it('D-10b a negative entry never produces a negative payout', () => {
    const game = table().totals([$(-10), $(20), $(20), $(20)]);
    for (const resolution of ['none', 'scale', 'accept'] as const) {
      game.resolution(resolution);
      const result = game.payout();
      expect(result.lines.every((l) => l.payoutCents >= 0)).toBe(true);
      expect(result.lines.every((l) => Number.isFinite(l.payoutCents))).toBe(true);
    }
  });

  it('D-10c scaling an all-zero count cannot divide by zero', () => {
    const game = table().totals([0, 0, 0, 0]).resolution('scale');
    const result = game.payout();
    expect(result.lines.every((l) => Number.isFinite(l.payoutCents))).toBe(true);
    expect(result.lines.every((l) => l.payoutCents === 0)).toBe(true);
    // And it must say so, rather than claiming the total came out even.
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
  });
});
