import { describe, expect, it } from 'vitest';
import { countUnits } from '@/lib/chips';
import { moneyIn, tableStakeCents, totalMoneyIn } from '@/lib/ledger';
import { createGame } from '../defaults';
import { reducer, stackUnitsFor, type Action } from '../reducer';
import type { GameState } from '@/lib/types';

const run = (state: GameState, ...actions: Action[]) =>
  actions.reduce((acc, action) => reducer(acc, action), state);

describe('game setup', () => {
  it('starts ready to use', () => {
    const game = createGame();
    expect(game.players).toHaveLength(4);
    expect(game.chipSet.colors.every((c) => c.value != null)).toBe(true);
  });

  it('applies a universal buy-in to everyone', () => {
    const game = run(createGame(), { type: 'applyUniversalBuyIn', cents: 5000 });
    expect(game.players.every((p) => p.buyInCents === 5000)).toBe(true);
  });

  it('lets one player buy in for more', () => {
    const base = createGame();
    const game = run(base, {
      type: 'updatePlayer',
      id: base.players[0]!.id,
      patch: { buyInCents: 6000 },
    });
    expect(game.players[0]!.buyInCents).toBe(6000);
    expect(game.players[1]!.buyInCents).toBe(2000);
  });

  it('throws away a stale distribution when the inputs change', () => {
    const game = run(createGame(), { type: 'runDistribution' });
    expect(game.distribution).not.toBeNull();
    expect(run(game, { type: 'applyUniversalBuyIn', cents: 4000 }).distribution).toBeNull();
    expect(run(game, { type: 'addPlayer' }).distribution).toBeNull();
    expect(run(game, { type: 'setDistributionMode', mode: 'deep' }).distribution).toBeNull();
  });

  it('reassigns chip values when the scale changes rather than blanking them', () => {
    const game = run(createGame(), {
      type: 'setScale',
      scale: { kind: 'points', unitsPerDollar: 50 },
    });
    expect(game.scale.kind).toBe('points');
    expect(game.chipSet.colors.some((c) => c.value != null)).toBe(true);
    expect(game.tournament.startingStackUnits).toBe(1000);
  });
});

describe('stackUnitsFor', () => {
  it('is one-to-one with cents in a dollar cash game', () => {
    expect(stackUnitsFor(createGame(), 2000)).toBe(2000);
  });

  it('scales a tournament stack with the money paid', () => {
    const game = run(createGame(), { type: 'setFormat', format: 'tournament' });
    expect(stackUnitsFor(game, game.tournament.buyInCents * 2)).toBe(
      game.tournament.startingStackUnits * 2,
    );
  });
});

describe('starting a game', () => {
  it('logs a buy-in and the chips handed over for each player', () => {
    const game = run(createGame(), { type: 'runDistribution' }, { type: 'startGame' });
    expect(game.phase).toBe('game');
    expect(game.ledger).toHaveLength(4);
    expect(totalMoneyIn(game.ledger)).toBe(8000);
    for (const entry of game.ledger) {
      expect(countUnits(entry.chips, game.chipSet)).toBe(2000);
    }
  });
});

describe('during the game', () => {
  const started = run(createGame(), { type: 'runDistribution' }, { type: 'startGame' });
  const player = started.players[1]!;

  it('hands out chips for a rebuy and tracks the money', () => {
    const game = run(started, {
      type: 'rebuy',
      playerId: player.id,
      amountCents: 2000,
      stackUnits: 2000,
    });
    expect(moneyIn(game.ledger, player.id)).toBe(4000);
    const rebuy = game.ledger.at(-1)!;
    expect(countUnits(rebuy.chips, game.chipSet)).toBe(2000);
  });

  it('takes an early cash-out back out of the pot', () => {
    const game = run(started, {
      type: 'cashOut',
      playerId: player.id,
      amountCents: 3000,
      chips: {},
      leave: true,
    });
    expect(game.players.find((p) => p.id === player.id)!.leftAt).toBeTruthy();
    expect(tableStakeCents(game.ledger)).toBe(5000);
  });

  it('undoes a cash-out and puts the player back', () => {
    const cashed = run(started, {
      type: 'cashOut',
      playerId: player.id,
      amountCents: 3000,
      chips: {},
      leave: true,
    });
    const game = run(cashed, { type: 'undoLedger', entryId: cashed.ledger.at(-1)!.id });
    expect(game.players.find((p) => p.id === player.id)!.leftAt).toBeFalsy();
    expect(tableStakeCents(game.ledger)).toBe(8000);
  });

  it('toggles a bust without losing the order', () => {
    const a = started.players[0]!.id;
    const b = started.players[1]!.id;
    let game = run(started, { type: 'toggleElimination', playerId: a });
    game = run(game, { type: 'toggleElimination', playerId: b });
    expect(game.eliminations).toEqual([a, b]);
    game = run(game, { type: 'toggleElimination', playerId: a });
    expect(game.eliminations).toEqual([b]);
  });

  it('forgets a removed player entirely', () => {
    const game = run(started, { type: 'removePlayer', id: player.id });
    expect(game.players.some((p) => p.id === player.id)).toBe(false);
    expect(game.ledger.some((e) => e.playerId === player.id)).toBe(false);
  });
});

describe('the clock', () => {
  const tourney = run(createGame(), { type: 'setFormat', format: 'tournament' });

  it('does not start twice', () => {
    const running = run(tourney, { type: 'clockStart' });
    expect(run(running, { type: 'clockStart' }).clock.runningSince).toBe(
      running.clock.runningSince,
    );
  });

  it('banks the elapsed time on pause', () => {
    const running = { ...tourney, clock: { ...tourney.clock, runningSince: Date.now() - 60_000 } };
    const paused = run(running, { type: 'clockPause' });
    expect(paused.clock.runningSince).toBeNull();
    expect(paused.clock.remainingMs).toBeLessThanOrEqual(tourney.clock.remainingMs - 59_000);
  });

  it('keeps running through a level change', () => {
    const withLevels = run(tourney, { type: 'clockStart' });
    const advanced = run(withLevels, { type: 'clockGoto', index: 1 });
    expect(advanced.clock.levelIndex).toBe(1);
    expect(advanced.clock.runningSince).not.toBeNull();
  });

  it('will not run off the end of the schedule', () => {
    const last = run(tourney, { type: 'clockGoto', index: 9999 });
    expect(last.clock.levelIndex).toBeLessThan(Math.max(1, tourney.tournament.levels.length));
    expect(run(tourney, { type: 'clockGoto', index: -5 }).clock.levelIndex).toBe(0);
  });

  it('never lets time go negative', () => {
    const game = run(tourney, { type: 'clockAdjust', deltaMs: -99_999_999 });
    expect(game.clock.remainingMs).toBe(0);
  });
});

describe('payout entry', () => {
  it('adds up chip counts per player', () => {
    const game = createGame();
    const white = game.chipSet.colors[0]!;
    const player = game.players[0]!;
    const next = run(game, {
      type: 'setPayoutChips',
      playerId: player.id,
      colorId: white.id,
      count: 8,
    });
    expect(next.payout.chipCounts[player.id]![white.id]).toBe(8);
  });

  it('clears every count at once', () => {
    const game = createGame();
    const player = game.players[0]!;
    const next = run(
      game,
      { type: 'setPayoutTotal', playerId: player.id, units: 4000 },
      { type: 'clearPayoutEntries' },
    );
    expect(next.payout.totals).toEqual({});
  });
});
