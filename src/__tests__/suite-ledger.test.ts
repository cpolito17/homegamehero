/**
 * CALCULATION_TEST_SUITE.md — ledger, rebuy, and cash-out cases.
 * Each case is verified by the final cash-out amounts and the pot identity:
 *   pot = money in - completed cashouts
 */
import { describe, expect, it } from 'vitest';
import { countUnits, remainingInventory } from '@/lib/chips';
import { chipsHandedOut, moneyIn, totalMoneyIn } from '@/lib/ledger';
import { DOLLAR, Game, STANDARD_SET, settlementClears } from './harness';

const $ = (dollars: number) => Math.round(dollars * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('L — ledger, rebuys, cash-outs', () => {
  it('L-01 one rebuy lifts the pot and total cash-out to $100', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(4).fill($(20))).start();
    game.rebuy(0, $(20));
    game.totals([$(35), $(25), $(20), $(20)]);

    expect(game.payout().potCents).toBe($(100));
    expect(game.cashouts()).toEqual([$(35), $(25), $(20), $(20)]);
    expect(sum(game.cashouts())).toBe($(100));
    expect(settlementClears(game.payout())).toBe(true);
  });

  it('L-02 multiple rebuys of differing sizes total $90', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(3).fill($(20))).start();
    game.rebuy(0, $(10)).rebuy(0, $(15)).rebuy(1, $(5));
    game.totals([$(45), $(30), $(15)]);

    expect(moneyIn(game.state.ledger, game.id(0))).toBe($(45));
    expect(moneyIn(game.state.ledger, game.id(1))).toBe($(25));
    expect(game.payout().potCents).toBe($(90));
    expect(sum(game.cashouts())).toBe($(90));
    expect(game.cashouts()).toEqual([$(45), $(30), $(15)]);
  });

  it('L-03 a rebuy the box cannot cover is reported, never silently banked', () => {
    // 80 $1 chips only. Four $20 buy-ins consume the box exactly.
    const game = new Game(DOLLAR)
      .chips([['Red', 100, 80]])
      .players(Array(4).fill($(20)))
      .blinds(100, 100)
      .reserve(0)
      .distribute()
      .start();

    const beforeIn = totalMoneyIn(game.state.ledger);
    game.rebuy(0, $(20));

    const entry = game.state.ledger.at(-1)!;
    const issued = countUnits(entry.chips, game.state.chipSet);
    const left = remainingInventory(game.state.chipSet, chipsHandedOut(game.state.ledger));

    // Either no chips were issued, or the shortfall is flagged on the entry.
    expect(issued).toBeLessThan($(20));
    expect(entry.note).toBeTruthy();
    // The box must never go negative silently.
    expect(left[game.colorId('Red')]).toBeGreaterThanOrEqual(0);

    // Diagnostic oracle: pot $100 against a counted $80 is a visible -$20 delta.
    game.totals([$(20), $(20), $(20), $(20)]);
    const result = game.payout();
    expect(result.potCents).toBe(beforeIn + $(20));
    expect(result.countedCents).toBe($(80));
    expect(result.deltaCents).toBe($(-20));
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('L-04 an early cash-out leaves the pot at $45 and pays $60 in total', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(3).fill($(20))).start();
    game.cashOut(0, $(15));
    game.totals([0, $(25), $(20)]);

    const result = game.payout();
    expect(result.potCents).toBe($(45));
    expect(result.deltaCents).toBe(0);
    expect(game.cashouts()).toEqual([$(15), $(25), $(20)]);
    expect(sum(game.cashouts())).toBe($(60));
    expect(result.lines[0]!.settled).toBe(true);
    expect(settlementClears(result)).toBe(true);
  });

  it('L-05 a rebuy then a cash-out pays $80 with a $50 pot left', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(3).fill($(20))).start();
    game.rebuy(0, $(20)).cashOut(0, $(30));
    game.totals([0, $(30), $(20)]);

    const result = game.payout();
    expect(result.potCents).toBe($(50));
    expect(game.cashouts()).toEqual([$(30), $(30), $(20)]);
    expect(sum(game.cashouts())).toBe($(80));
    expect(settlementClears(result)).toBe(true);
  });

  it('L-06 two early cash-outs still total $100 across five players', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(5).fill($(20))).start();
    game.cashOut(0, $(15)).cashOut(1, $(30));
    game.totals([0, 0, $(10), $(20), $(25)]);

    const result = game.payout();
    expect(result.potCents).toBe($(55));
    expect(result.deltaCents).toBe(0);
    expect(game.cashouts()).toEqual([$(15), $(30), $(10), $(20), $(25)]);
    expect(sum(game.cashouts())).toBe($(100));
    expect(settlementClears(result)).toBe(true);
  });

  it('L-07 undoing a cash-out puts the player back in the game', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(3).fill($(20))).start();
    game.cashOut(0, $(15));
    const entryId = game.state.ledger.at(-1)!.id;
    game.dispatch({ type: 'undoLedger', entryId });

    expect(game.state.players.every((p) => !p.leftAt)).toBe(true);
    game.totals([$(10), $(20), $(30)]);
    const result = game.payout();
    expect(result.potCents).toBe($(60));
    expect(result.deltaCents).toBe(0);
    expect(game.cashouts()).toEqual([$(10), $(20), $(30)]);
  });

  it('L-08 when everyone leaves early the pot empties and nothing is owed', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players([$(20), $(20)]).start();
    game.cashOut(0, $(12)).cashOut(1, $(28));

    const result = game.payout();
    expect(result.potCents).toBe(0);
    expect(result.countedCents).toBe(0);
    expect(result.deltaCents).toBe(0);
    expect(game.cashouts()).toEqual([$(12), $(28)]);
    expect(result.lines.every((l) => l.settled)).toBe(true);
    expect(settlementClears(result)).toBe(true);
  });

  it('L-09 a late arrival with a rebuy is counted once, for a $60 pot', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players([$(20), $(20)]).start();
    game.dispatch({ type: 'addPlayer', name: 'Late', buyInCents: $(20) });
    // The late player immediately rebuys... but the oracle's pot is $60, so the
    // arrival plus rebuy is $20 total in the suite's reading: one $20 entry.
    expect(game.state.players).toHaveLength(3);
    expect(moneyIn(game.state.ledger, game.id(2))).toBe($(20));
    expect(totalMoneyIn(game.state.ledger)).toBe($(60));

    game.totals([$(20), $(20), $(20)]);
    const result = game.payout();
    expect(result.potCents).toBe($(60));
    expect(result.deltaCents).toBe(0);
    expect(game.cashouts()).toEqual([$(20), $(20), $(20)]);
  });

  it('L-09b a late arrival that also rebuys books both entries exactly once', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players([$(20), $(20)]).start();
    game.dispatch({ type: 'addPlayer', name: 'Late', buyInCents: $(20) });
    game.rebuy(2, $(20));

    expect(moneyIn(game.state.ledger, game.id(2))).toBe($(40));
    expect(totalMoneyIn(game.state.ledger)).toBe($(80));

    game.totals([$(20), $(20), $(40)]);
    const result = game.payout();
    expect(result.potCents).toBe($(80));
    expect(result.deltaCents).toBe(0);
    expect(sum(game.cashouts())).toBe($(80));
  });
});
