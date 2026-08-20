import type { BlindLevel, Notice } from './types';
import { clamp, gcdAll } from './money';

/**
 * The smallest amount that can actually be put in the middle.
 *
 * Real chip ladders are divisible chains (25 | 50 | 100 | 500), so the smallest
 * denomination is the increment. Custom values that don't chain fall back to the
 * gcd, which is the true lower bound on what a sum of chips can express.
 */
export function blindStep(denominations: number[]): number {
  const denoms = denominations.filter((d) => d > 0).sort((a, b) => a - b);
  if (denoms.length === 0) return 0;
  const smallest = denoms[0]!;
  return denoms.every((d) => d % smallest === 0) ? smallest : gcdAll(denoms);
}

const MANTISSAS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/**
 * Nearest human-looking number (25, 50, 100, 150…) that is still payable.
 *
 * Only round mantissas are candidates. Snapping the raw value to the grain as
 * well would always win on distance and defeat the point. That is how you end
 * up announcing blinds of 95 and 575.
 */
export function niceRound(value: number, grain: number): number {
  if (grain <= 0 || value <= 0) return Math.max(grain, 0);
  const magnitude = Math.floor(Math.log10(value));
  const candidates = new Set<number>();
  for (const exp of [magnitude - 1, magnitude, magnitude + 1]) {
    for (const m of MANTISSAS) {
      const snapped = Math.round((m * Math.pow(10, exp)) / grain) * grain;
      if (snapped >= grain) candidates.add(snapped);
    }
  }
  if (candidates.size === 0) candidates.add(Math.max(grain, Math.round(value / grain) * grain));

  let best = grain;
  let bestScore = Infinity;
  for (const c of candidates) {
    const score = Math.abs(Math.log(c / value));
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

/** Smallest payable value strictly greater than `value`. */
export function nextPayableAbove(value: number, step: number): number {
  if (step <= 0) return value + 1;
  return Math.floor(value / step) * step + step;
}

/** Half a big blind, when the chips can make it. Otherwise the blinds are equal. */
export function smallBlindFor(bigBlind: number, step: number): number {
  const half = bigBlind / 2;
  if (Number.isInteger(half) && step > 0 && half % step === 0 && half > 0) return half;
  return bigBlind;
}

// ---------------------------------------------------------------------------
// Cash game
// ---------------------------------------------------------------------------

export interface BlindSuggestion {
  smallBlind: number;
  bigBlind: number;
  /** Starting stack expressed in big blinds. */
  depthBB: number;
  notices: Notice[];
}

const MULTIPLIERS = [
  1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200, 250, 300, 400, 500,
];

/**
 * Recommends blinds from stack depth, not from the size of the pot.
 *
 * In a cash game the pot doesn't set the stakes, the starting stack does. A
 * 50 big blind stack plays the same whether two people or nine are sitting down.
 * Player count only matters for whether the chips go around, which the
 * distribution solver handles separately.
 */
export function recommendCashBlinds(opts: {
  stackUnits: number;
  denominations: number[];
  depthTargetBB: number;
}): BlindSuggestion {
  const notices: Notice[] = [];
  const step = blindStep(opts.denominations);
  const stack = opts.stackUnits;

  if (step <= 0 || stack <= 0) {
    return { smallBlind: 0, bigBlind: 0, depthBB: 0, notices };
  }

  const target = clamp(opts.depthTargetBB, 8, 400);
  const pool = new Set<number>();
  for (const m of MULTIPLIERS) pool.add(m * step);
  for (const d of opts.denominations) {
    if (d % step === 0) {
      pool.add(d);
      pool.add(d * 2);
    }
  }

  let best = step;
  let bestScore = Infinity;
  const roundness = (bb: number) => {
    const m = bb / step;
    const idx = MULTIPLIERS.indexOf(m);
    return idx === -1 ? 0.06 : idx * 0.002;
  };

  for (const bb of pool) {
    if (bb < step) continue;
    const depth = stack / bb;
    if (depth < 8 || depth > 400) continue;
    // Log-space distance keeps "half the target" and "twice the target" equally bad.
    let score = Math.abs(Math.log(depth / target)) + roundness(bb);
    if (smallBlindFor(bb, step) === bb) score += 0.12; // no half-blind chip
    if (score < bestScore) {
      bestScore = score;
      best = bb;
    }
  }

  const bigBlind = best;
  const smallBlind = smallBlindFor(bigBlind, step);
  const depthBB = bigBlind > 0 ? stack / bigBlind : 0;

  if (smallBlind === bigBlind) {
    notices.push({
      level: 'info',
      message:
        'No chip small enough to make half a big blind, so the small blind matches the big one. Play it as a button blind.',
    });
  }
  if (depthBB < 25) {
    notices.push({
      level: 'warn',
      message: `${Math.round(depthBB)} big blinds is shallow. Expect a lot of all-ins preflop, or raise the buy-in and add a smaller chip.`,
    });
  } else if (depthBB > 150) {
    notices.push({
      level: 'warn',
      message: `${Math.round(depthBB)} big blinds is very deep. Fine if everyone's patient, slow if they're not.`,
    });
  }

  return { smallBlind, bigBlind, depthBB, notices };
}

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

export interface LevelPlanInput {
  startingStackUnits: number;
  players: number;
  denominations: number[];
  levelMinutes: number;
  targetDurationMinutes: number;
  anteStartLevel: number | null;
  breakEveryLevels: number;
  breakMinutes: number;
  /** Chips expected to enter from rebuys/add-ons, as a fraction of the starting field. */
  expectedRebuyRatio?: number;
}

/**
 * Builds a blind schedule that lands the tournament near its target length.
 *
 * The end condition is chip-driven: a tournament finishes when the big blind is
 * large enough relative to all the chips in play that stacks can't survive an
 * orbit. Working back from that gives the growth rate per level.
 */
export function buildLevels(input: LevelPlanInput): BlindLevel[] {
  const step = blindStep(input.denominations);
  if (step <= 0 || input.startingStackUnits <= 0 || input.players <= 0) return [];

  const levelMinutes = Math.max(1, Math.round(input.levelMinutes));
  const breakEvery = Math.max(0, Math.round(input.breakEveryLevels));
  const breakMinutes = Math.max(0, Math.round(input.breakMinutes));

  // Big blinds move on twice the chip increment so half of one is always payable.
  // Without this the small blind flips between BB/2 and BB from level to level and
  // can actually go *down* while the big blind goes up.
  const grain = step * 2;

  // Time per level once breaks are amortised in.
  const perLevel = levelMinutes + (breakEvery > 0 ? breakMinutes / breakEvery : 0);
  const levelCount = clamp(Math.round(input.targetDurationMinutes / perLevel), 4, 60);

  const totalChips =
    input.startingStackUnits * input.players * (1 + (input.expectedRebuyRatio ?? 0));

  const firstBB = Math.max(grain, niceRound(input.startingStackUnits / 100, grain));
  // Play ends when one stack holding everything is ~20 big blinds deep.
  const lastBB = Math.max(firstBB * 2, niceRound(totalChips / 20, grain));

  const ratio =
    levelCount > 1 ? clamp(Math.pow(lastBB / firstBB, 1 / (levelCount - 1)), 1.15, 1.6) : 1.3;

  const levels: BlindLevel[] = [];
  let previousBB = 0;
  let playLevel = 0;

  for (let i = 0; i < levelCount; i++) {
    let bb = niceRound(firstBB * Math.pow(ratio, i), grain);
    if (bb <= previousBB) bb = nextPayableAbove(previousBB, grain);
    previousBB = bb;
    playLevel++;

    const anteOn = input.anteStartLevel != null && playLevel >= input.anteStartLevel;
    levels.push({
      index: levels.length + 1,
      smallBlind: smallBlindFor(bb, step),
      bigBlind: bb,
      ante: anteOn ? bb : 0,
      minutes: levelMinutes,
      isBreak: false,
    });

    const isLast = i === levelCount - 1;
    if (!isLast && breakEvery > 0 && breakMinutes > 0 && playLevel % breakEvery === 0) {
      levels.push({
        index: levels.length + 1,
        smallBlind: 0,
        bigBlind: 0,
        ante: 0,
        minutes: breakMinutes,
        isBreak: true,
      });
    }
  }

  return levels;
}

export function scheduleDurationMinutes(levels: BlindLevel[]): number {
  return levels.reduce((sum, l) => sum + l.minutes, 0);
}

/** Ordinal position of a level among the playing (non-break) levels. */
export function playLevelNumber(levels: BlindLevel[], index: number): number {
  let n = 0;
  for (let i = 0; i <= index && i < levels.length; i++) if (!levels[i]!.isBreak) n++;
  return n;
}
