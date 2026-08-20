import { uid, type ChipScale } from '@/lib/money';
import type { CashConfig, GameState, TournamentConfig } from '@/lib/types';
import { PALETTE } from '@/lib/chips';

/** A common 300-chip home set, so the app is usable before anything is typed. */
function starterChipSet() {
  const spec: [string, number, number][] = [
    ['White', 200, 25],
    ['Red', 150, 100],
    ['Green', 100, 500],
    ['Black', 50, 2500],
  ];
  return {
    id: uid('set'),
    name: 'My chip set',
    hasPrintedValues: true,
    colors: spec.map(([label, quantity, value]) => ({
      id: uid('color'),
      label,
      hex: PALETTE.find((p) => p.label === label)?.hex ?? '#888888',
      quantity,
      value,
    })),
  };
}

export function defaultCash(): CashConfig {
  return {
    universalBuyInCents: 2000,
    depthTargetBB: 50,
    smallBlind: 25,
    bigBlind: 50,
    blindsAuto: true,
  };
}

export function defaultTournament(): TournamentConfig {
  return {
    buyInCents: 2000,
    startingStackUnits: 2000,
    levelMinutes: 15,
    targetDurationMinutes: 180,
    anteStartLevel: 5,
    breakEveryLevels: 4,
    breakMinutes: 10,
    rebuyThroughLevel: 4,
    rebuyCents: 2000,
    rebuyStackUnits: 2000,
    addOnEnabled: true,
    addOnCents: 2000,
    addOnStackUnits: 3000,
    levels: [],
    // Deliberately not a recommended structure — the host sets these each game.
    prizeSplit: [{ place: 1, percent: 100 }],
    levelsAuto: true,
  };
}

export function createGame(scale: ChipScale = { kind: 'dollar' }): GameState {
  const now = Date.now();
  return {
    version: 1,
    id: uid('game'),
    name: 'Home game',
    createdAt: now,
    updatedAt: now,
    format: 'cash',
    scale,
    phase: 'pregame',
    chipSet: starterChipSet(),
    players: Array.from({ length: 4 }, (_, i) => ({
      id: uid('player'),
      name: `Player ${i + 1}`,
      buyInCents: 2000,
      seat: i,
      leftAt: null,
    })),
    ledger: [],
    cash: defaultCash(),
    tournament: defaultTournament(),
    distribution: null,
    distributionMode: 'balanced',
    reserveStacks: 2,
    clock: { levelIndex: 0, runningSince: null, remainingMs: 15 * 60_000 },
    eliminations: [],
    retiredColorIds: [],
    payout: { entryMode: 'chips', chipCounts: {}, totals: {}, resolution: 'none', computed: false },
  };
}
