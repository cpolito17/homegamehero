/**
 * CALCULATION_TEST_SUITE.md — tournament cases.
 * Prizes must sum to the prize pool exactly:
 *   pool = buy-ins + rebuys + add-ons
 */
import { describe, expect, it } from 'vitest';
import { computePrizes, finishOrderFrom, prizeSplitNotices } from '@/lib/payout';
import { totalMoneyIn } from '@/lib/ledger';
import { rebuysClosed } from '@/state/reducer';
import { DOLLAR, Game, POINTS_SET, STANDARD_SET, points } from './harness';

const $ = (dollars: number) => Math.round(dollars * 100);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Seat a tournament with a fixed entry fee. */
function tournament(entries: number, buyIn: number, scale = DOLLAR, set = STANDARD_SET) {
  const game = new Game(scale);
  game.dispatch({ type: 'setFormat', format: 'tournament' });
  game.dispatch({ type: 'patchTournament', patch: { buyInCents: buyIn } });
  return game.chips(set).players(Array(entries).fill(buyIn)).start();
}

/** Prizes in place order, as the Payout phase computes them. */
function prizesOf(game: Game, finishOrder: string[]) {
  return computePrizes({
    poolCents: totalMoneyIn(game.state.ledger),
    split: game.state.tournament.prizeSplit,
    finishOrder,
  });
}

describe('T — tournaments', () => {
  it('T-01 a three-player freezeout pays 30 / 18 / 12', () => {
    const game = tournament(3, $(20)).prizeSplit([
      { place: 1, percent: 50 },
      { place: 2, percent: 30 },
      { place: 3, percent: 20 },
    ]);

    expect(game.pool()).toBe($(60));
    const { prizes } = prizesOf(game, [game.id(0), game.id(1), game.id(2)]);
    expect(prizes.map((p) => p.cents)).toEqual([$(30), $(18), $(12)]);
    expect(sum(prizes.map((p) => p.cents))).toBe($(60));
  });

  it('T-02 an odd-cent pool still adds up to the last cent', () => {
    const game = tournament(5, $(20.01)).prizeSplit([
      { place: 1, percent: 50 },
      { place: 2, percent: 30 },
      { place: 3, percent: 20 },
    ]);

    expect(game.pool()).toBe($(100.05));
    const { prizes } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(prizes.map((p) => p.cents)).toEqual([$(50.03), $(30.01), $(20.01)]);
    expect(sum(prizes.map((p) => p.cents))).toBe($(100.05));
  });

  it('T-03 a rebuy and an add-on both feed the pool', () => {
    const game = tournament(4, $(20));
    game.rebuy(0, $(20));
    game.rebuy(1, $(30));
    game.prizeSplit([
      { place: 1, percent: 60 },
      { place: 2, percent: 30 },
      { place: 3, percent: 10 },
    ]);

    expect(game.pool()).toBe($(130));
    const { prizes } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(prizes.map((p) => p.cents)).toEqual([$(78), $(39), $(13)]);
    expect(sum(prizes.map((p) => p.cents))).toBe($(130));
  });

  it('T-04 two rebuys from one player raise the pool to $80', () => {
    const game = tournament(3, $(20));
    game.rebuy(0, $(10)).rebuy(0, $(10));
    game.prizeSplit([
      { place: 1, percent: 50 },
      { place: 2, percent: 30 },
      { place: 3, percent: 20 },
    ]);

    expect(game.pool()).toBe($(80));
    const { prizes } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(prizes.map((p) => p.cents)).toEqual([$(40), $(24), $(16)]);
  });

  it('T-05 survivors rank ahead of the busted', () => {
    const game = tournament(4, $(20)).prizeSplit([
      { place: 1, percent: 40 },
      { place: 2, percent: 30 },
      { place: 3, percent: 20 },
      { place: 4, percent: 10 },
    ]);
    game.bust(2); // Player C busts first, so they finish last.

    const order = finishOrderFrom(
      game.state.eliminations,
      game.state.players.map((p) => p.id),
    );
    expect(order).toEqual([game.id(0), game.id(1), game.id(3), game.id(2)]);

    const { prizes } = prizesOf(game, order);
    expect(prizes.map((p) => p.cents)).toEqual([$(32), $(24), $(16), $(8)]);
    expect(prizes.map((p) => p.playerId)).toEqual([
      game.id(0),
      game.id(1),
      game.id(3),
      game.id(2),
    ]);
  });

  it('T-06 a split that does not reach 100% is rejected', () => {
    const game = tournament(3, $(20)).prizeSplit([
      { place: 1, percent: 60 },
      { place: 2, percent: 30 },
    ]);

    const notices = prizeSplitNotices(game.state.tournament.prizeSplit);
    expect(notices.some((n) => n.level === 'error')).toBe(true);
    const { notices: computed } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(computed.some((n) => n.level === 'error')).toBe(true);
  });

  it('T-07 past the rebuy cutoff the pool stays at $60', () => {
    const game = tournament(3, $(20));
    game.dispatch({ type: 'patchTournament', patch: { rebuyThroughLevel: 1 } });
    game.dispatch({ type: 'clockGoto', index: 1 });
    game.prizeSplit([{ place: 1, percent: 100 }]);

    // Level 2 with rebuys through level 1: the window has closed.
    expect(rebuysClosed(game.state)).toBe(true);

    // A rebuy attempted past the cutoff must not reach the pool, and a busted
    // player is no exception: they are exactly who would try.
    game.rebuy(0, $(20));
    game.bust(1);
    game.rebuy(1, $(20));
    expect(game.pool()).toBe($(60));
    const { prizes } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(prizes.map((p) => p.cents)).toEqual([$(60)]);
  });

  it('T-08 point chips do not change the money maths', () => {
    const game = tournament(4, $(20), points(50), POINTS_SET).prizeSplit([
      { place: 1, percent: 50 },
      { place: 2, percent: 25 },
      { place: 3, percent: 15 },
      { place: 4, percent: 10 },
    ]);

    expect(game.pool()).toBe($(80));
    const { prizes } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(prizes.map((p) => p.cents)).toEqual([$(40), $(20), $(12), $(8)]);
    expect(sum(prizes.map((p) => p.cents))).toBe($(80));
  });

  it('T-09 a one-player tournament returns the entry', () => {
    const game = tournament(1, $(20)).prizeSplit([{ place: 1, percent: 100 }]);
    expect(game.pool()).toBe($(20));
    const { prizes } = prizesOf(game, [game.id(0)]);
    expect(prizes.map((p) => p.cents)).toEqual([$(20)]);
  });

  it('T-10 a generated schedule still pays the winner the whole $160', () => {
    const game = new Game(DOLLAR);
    game.dispatch({ type: 'setFormat', format: 'tournament' });
    game.dispatch({
      type: 'patchTournament',
      patch: {
        buyInCents: $(20),
        levelMinutes: 15,
        targetDurationMinutes: 180,
        anteStartLevel: 5,
        breakEveryLevels: 4,
      },
    });
    game.chips(STANDARD_SET).players(Array(8).fill($(20)));
    game.dispatch({ type: 'patchTournament', patch: { levelsAuto: true } });
    game.start().prizeSplit([{ place: 1, percent: 100 }]);

    const levels = game.state.tournament.levels;
    expect(levels.length).toBeGreaterThan(0);
    // Blinds never go backwards across playing levels.
    const playing = levels.filter((l) => !l.isBreak);
    for (let i = 1; i < playing.length; i++) {
      expect(playing[i]!.bigBlind).toBeGreaterThanOrEqual(playing[i - 1]!.bigBlind);
    }
    expect(levels.some((l) => l.isBreak)).toBe(true);
    expect(playing.slice(4).some((l) => l.ante > 0)).toBe(true);

    expect(game.pool()).toBe($(160));
    const { prizes } = prizesOf(game, game.state.players.map((p) => p.id));
    expect(prizes.map((p) => p.cents)).toEqual([$(160)]);
  });
});
