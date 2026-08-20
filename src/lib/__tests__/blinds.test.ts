import { describe, expect, it } from 'vitest';
import {
  blindStep,
  buildLevels,
  niceRound,
  recommendCashBlinds,
  scheduleDurationMinutes,
  smallBlindFor,
} from '../blinds';

const HOME_DENOMS = [25, 100, 500, 2500];

describe('blindStep', () => {
  it('uses the smallest chip of a divisible ladder', () => {
    expect(blindStep(HOME_DENOMS)).toBe(25);
  });

  it('falls back to the gcd when the ladder does not chain', () => {
    expect(blindStep([6, 10, 15])).toBe(1);
    expect(blindStep([])).toBe(0);
  });
});

describe('niceRound', () => {
  it('lands on numbers a table can hear', () => {
    expect(niceRound(90, 10)).toBe(100);
    expect(niceRound(112, 10)).toBe(100);
    expect(niceRound(560, 50)).toBe(600);
  });

  it('never returns less than one increment', () => {
    expect(niceRound(1, 25)).toBe(25);
  });
});

describe('smallBlindFor', () => {
  it('halves the big blind when the chips allow', () => {
    expect(smallBlindFor(100, 25)).toBe(50);
  });

  it('matches the big blind when there is no half-size chip', () => {
    expect(smallBlindFor(100, 100)).toBe(100);
    expect(smallBlindFor(25, 25)).toBe(25);
  });
});

describe('recommendCashBlinds', () => {
  it('targets the requested stack depth', () => {
    const result = recommendCashBlinds({
      stackUnits: 2000,
      denominations: HOME_DENOMS,
      depthTargetBB: 50,
    });
    const depth = 2000 / result.bigBlind;
    expect(depth).toBeGreaterThanOrEqual(30);
    expect(depth).toBeLessThanOrEqual(80);
  });

  it('always picks a payable big blind', () => {
    for (const stack of [1000, 2000, 5000, 10_000, 50_000]) {
      const result = recommendCashBlinds({
        stackUnits: stack,
        denominations: HOME_DENOMS,
        depthTargetBB: 50,
      });
      expect(result.bigBlind % 25).toBe(0);
      expect(result.smallBlind % 25).toBe(0);
      expect(result.smallBlind).toBeLessThanOrEqual(result.bigBlind);
    }
  });

  it('moves the blinds when the depth target changes', () => {
    const deep = recommendCashBlinds({
      stackUnits: 10_000,
      denominations: HOME_DENOMS,
      depthTargetBB: 100,
    });
    const action = recommendCashBlinds({
      stackUnits: 10_000,
      denominations: HOME_DENOMS,
      depthTargetBB: 30,
    });
    expect(action.bigBlind).toBeGreaterThan(deep.bigBlind);
  });

  it('flags a stack that is too shallow to play', () => {
    const result = recommendCashBlinds({
      stackUnits: 500,
      denominations: [100, 500],
      depthTargetBB: 50,
    });
    expect(result.notices.some((n) => n.level === 'warn')).toBe(true);
  });

  it('returns nothing rather than guessing with no chips', () => {
    const result = recommendCashBlinds({ stackUnits: 2000, denominations: [], depthTargetBB: 50 });
    expect(result.bigBlind).toBe(0);
  });
});

describe('buildLevels', () => {
  const schedule = buildLevels({
    startingStackUnits: 10_000,
    players: 8,
    denominations: [25, 100, 500, 1000, 5000],
    levelMinutes: 15,
    targetDurationMinutes: 180,
    anteStartLevel: 5,
    breakEveryLevels: 4,
    breakMinutes: 10,
  });

  it('produces a schedule near the requested length', () => {
    const hours = scheduleDurationMinutes(schedule) / 60;
    expect(hours).toBeGreaterThan(2.4);
    expect(hours).toBeLessThan(3.6);
  });

  it('raises the big blind every level and never lowers the small one', () => {
    const play = schedule.filter((l) => !l.isBreak);
    for (let i = 1; i < play.length; i++) {
      expect(play[i]!.bigBlind).toBeGreaterThan(play[i - 1]!.bigBlind);
      expect(play[i]!.smallBlind).toBeGreaterThanOrEqual(play[i - 1]!.smallBlind);
    }
  });

  it('keeps every blind payable with the chips in play', () => {
    for (const level of schedule.filter((l) => !l.isBreak)) {
      expect(level.bigBlind % 25).toBe(0);
      expect(level.smallBlind % 25).toBe(0);
      expect(level.smallBlind * 2).toBe(level.bigBlind);
    }
  });

  it('starts antes at the level it was told to', () => {
    const play = schedule.filter((l) => !l.isBreak);
    expect(play[3]!.ante).toBe(0);
    expect(play[4]!.ante).toBe(play[4]!.bigBlind);
  });

  it('inserts breaks on the requested cadence and never at the end', () => {
    const breaks = schedule.filter((l) => l.isBreak);
    expect(breaks.length).toBeGreaterThan(0);
    expect(schedule[schedule.length - 1]!.isBreak).toBe(false);
  });

  it('skips antes entirely when told to', () => {
    const noAnte = buildLevels({
      startingStackUnits: 10_000,
      players: 8,
      denominations: [25, 100, 500],
      levelMinutes: 20,
      targetDurationMinutes: 120,
      anteStartLevel: null,
      breakEveryLevels: 0,
      breakMinutes: 0,
    });
    expect(noAnte.every((l) => l.ante === 0)).toBe(true);
    expect(noAnte.every((l) => !l.isBreak)).toBe(true);
  });

  it('returns nothing when there is nothing to work from', () => {
    expect(
      buildLevels({
        startingStackUnits: 0,
        players: 8,
        denominations: [25],
        levelMinutes: 15,
        targetDurationMinutes: 180,
        anteStartLevel: null,
        breakEveryLevels: 4,
        breakMinutes: 10,
      }),
    ).toEqual([]);
  });
});
