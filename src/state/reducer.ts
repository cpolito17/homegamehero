import { buildLevels } from '@/lib/blinds';
import { activeColors, assignValues, denominations, newChipColor } from '@/lib/chips';
import { distribute, rebuyStack } from '@/lib/distribution';
import { chipsHandedOut } from '@/lib/ledger';
import { centsToUnits, uid, type ChipScale } from '@/lib/money';
import type {
  BlindLevel,
  CashConfig,
  ChipColor,
  ChipCount,
  ChipSet,
  DistributionMode,
  GameFormat,
  GameState,
  LedgerEntry,
  Phase,
  Player,
  PrizeSlot,
  TournamentConfig,
} from '@/lib/types';
import { createGame } from './defaults';

export type Action =
  | { type: 'reset' }
  | { type: 'load'; state: GameState }
  | { type: 'setName'; name: string }
  | { type: 'setFormat'; format: GameFormat }
  | { type: 'setScale'; scale: ChipScale }
  | { type: 'setPhase'; phase: Phase }
  | { type: 'setChipSet'; chipSet: ChipSet }
  | { type: 'patchChipSet'; patch: Partial<ChipSet> }
  | { type: 'addColor' }
  | { type: 'updateColor'; id: string; patch: Partial<ChipColor> }
  | { type: 'removeColor'; id: string }
  | { type: 'setColors'; colors: ChipColor[] }
  | { type: 'addPlayer'; name?: string }
  | { type: 'updatePlayer'; id: string; patch: Partial<Player> }
  | { type: 'removePlayer'; id: string }
  | { type: 'applyUniversalBuyIn'; cents: number }
  | { type: 'patchCash'; patch: Partial<CashConfig> }
  | { type: 'patchTournament'; patch: Partial<TournamentConfig> }
  | { type: 'setPrizeSplit'; split: PrizeSlot[] }
  | { type: 'setDistributionMode'; mode: DistributionMode }
  | { type: 'setReserveStacks'; count: number }
  | { type: 'runDistribution' }
  | { type: 'startGame' }
  | { type: 'rebuy'; playerId: string; amountCents: number; stackUnits: number }
  | { type: 'cashOut'; playerId: string; amountCents: number; chips: ChipCount; leave: boolean }
  | { type: 'undoLedger'; entryId: string }
  | { type: 'toggleElimination'; playerId: string }
  | { type: 'retireColor'; colorId: string }
  | { type: 'clockStart' }
  | { type: 'clockPause' }
  | { type: 'clockGoto'; index: number }
  | { type: 'clockAdjust'; deltaMs: number }
  | { type: 'clockReset' }
  | { type: 'setPayoutMode'; mode: 'chips' | 'total' }
  | { type: 'setPayoutChips'; playerId: string; colorId: string; count: number }
  | { type: 'setPayoutTotal'; playerId: string; units: number }
  | { type: 'setResolution'; resolution: 'none' | 'scale' | 'accept' }
  | { type: 'setPayoutComputed'; computed: boolean }
  | { type: 'clearPayoutEntries' };

/** Blinds currently in force, whichever format is being played. */
export function currentBlinds(state: GameState): { smallBlind: number; bigBlind: number; ante: number } {
  if (state.format === 'cash') {
    return { smallBlind: state.cash.smallBlind, bigBlind: state.cash.bigBlind, ante: 0 };
  }
  const level = state.tournament.levels[state.clock.levelIndex];
  if (!level) return { smallBlind: 0, bigBlind: 0, ante: 0 };
  return { smallBlind: level.smallBlind, bigBlind: level.bigBlind, ante: level.ante };
}

/** The stack a player should be given for a given amount of money. */
export function stackUnitsFor(state: GameState, cents: number): number {
  if (state.format === 'tournament') {
    const { buyInCents, startingStackUnits } = state.tournament;
    if (buyInCents <= 0) return 0;
    return Math.round((cents / buyInCents) * startingStackUnits);
  }
  return centsToUnits(cents, state.scale);
}

/** The blind schedule implied by the current tournament settings and chip set. */
export function generateLevels(state: GameState): BlindLevel[] {
  return buildLevels({
    startingStackUnits: state.tournament.startingStackUnits,
    players: Math.max(1, state.players.length),
    denominations: denominations(state.chipSet),
    levelMinutes: state.tournament.levelMinutes,
    targetDurationMinutes: state.tournament.targetDurationMinutes,
    anteStartLevel: state.tournament.anteStartLevel,
    breakEveryLevels: state.tournament.breakEveryLevels,
    breakMinutes: state.tournament.breakMinutes,
    expectedRebuyRatio: state.tournament.rebuyThroughLevel > 0 ? 0.5 : 0,
  });
}

function levelDurationMs(state: GameState, index: number): number {
  const level = state.tournament.levels[index];
  return (level?.minutes ?? state.tournament.levelMinutes) * 60_000;
}

function touch(state: GameState): GameState {
  return { ...state, updatedAt: Date.now() };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'reset':
      return createGame(state.scale);

    case 'load':
      return action.state;

    case 'setName':
      return touch({ ...state, name: action.name });

    case 'setFormat': {
      // Build the schedule here rather than relying on a component being mounted,
      // so a tournament is never handed to the clock with no levels in it.
      const next = { ...state, format: action.format, distribution: null };
      if (action.format === 'tournament' && state.tournament.levelsAuto) {
        const levels = generateLevels(next);
        return touch({
          ...next,
          tournament: { ...next.tournament, levels },
          clock: {
            levelIndex: 0,
            runningSince: null,
            remainingMs: (levels[0]?.minutes ?? next.tournament.levelMinutes) * 60_000,
          },
        });
      }
      return touch(next);
    }

    case 'setScale': {
      // Chip values mean something different in the new scale — 25 cents is not
      // 25 points — so they can't carry over. Rather than leaving the host with a
      // blank set and no schedule, seed sensible values they can type over.
      const scale = action.scale;
      const buyInCents =
        state.format === 'tournament' ? state.tournament.buyInCents : state.cash.universalBuyInCents;
      const stackUnits =
        scale.kind === 'points'
          ? Math.max(1, Math.round((buyInCents / 100) * scale.unitsPerDollar))
          : buyInCents;

      const cleared = {
        ...state.chipSet,
        colors: state.chipSet.colors.map((c) => ({ ...c, value: null })),
      };
      const { colors } = assignValues(cleared, {
        strategy: 'quantity',
        stackUnits,
        scale,
      });

      return touch({
        ...state,
        scale,
        chipSet: { ...cleared, colors },
        tournament: { ...state.tournament, startingStackUnits: stackUnits, levelsAuto: true },
        cash: { ...state.cash, blindsAuto: true },
        distribution: null,
      });
    }

    case 'setPhase':
      return touch({ ...state, phase: action.phase });

    case 'setChipSet':
      return touch({ ...state, chipSet: action.chipSet, distribution: null });

    case 'patchChipSet':
      return touch({ ...state, chipSet: { ...state.chipSet, ...action.patch } });

    case 'addColor':
      return touch({
        ...state,
        chipSet: {
          ...state.chipSet,
          colors: [...state.chipSet.colors, newChipColor(state.chipSet.colors.length)],
        },
        distribution: null,
      });

    case 'updateColor':
      return touch({
        ...state,
        chipSet: {
          ...state.chipSet,
          colors: state.chipSet.colors.map((c) =>
            c.id === action.id ? { ...c, ...action.patch } : c,
          ),
        },
        distribution: null,
      });

    case 'removeColor':
      return touch({
        ...state,
        chipSet: {
          ...state.chipSet,
          colors: state.chipSet.colors.filter((c) => c.id !== action.id),
        },
        distribution: null,
      });

    case 'setColors':
      return touch({
        ...state,
        chipSet: { ...state.chipSet, colors: action.colors },
        distribution: null,
      });

    case 'addPlayer': {
      const seat = state.players.length;
      const buyIn =
        state.format === 'tournament' ? state.tournament.buyInCents : state.cash.universalBuyInCents;
      return touch({
        ...state,
        players: [
          ...state.players,
          {
            id: uid('player'),
            name: action.name?.trim() || `Player ${seat + 1}`,
            buyInCents: buyIn,
            seat,
            leftAt: null,
          },
        ],
        distribution: null,
      });
    }

    case 'updatePlayer':
      return touch({
        ...state,
        players: state.players.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
        distribution: action.patch.buyInCents != null ? null : state.distribution,
      });

    case 'removePlayer':
      return touch({
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
        ledger: state.ledger.filter((e) => e.playerId !== action.id),
        eliminations: state.eliminations.filter((id) => id !== action.id),
        distribution: null,
      });

    case 'applyUniversalBuyIn':
      return touch({
        ...state,
        cash: { ...state.cash, universalBuyInCents: action.cents },
        players: state.players.map((p) => ({ ...p, buyInCents: action.cents })),
        distribution: null,
      });

    case 'patchCash': {
      const cash = { ...state.cash, ...action.patch };
      const blindsChanged = action.patch.smallBlind != null || action.patch.bigBlind != null;
      return touch({
        ...state,
        cash,
        distribution: blindsChanged ? null : state.distribution,
      });
    }

    case 'patchTournament':
      return touch({
        ...state,
        tournament: { ...state.tournament, ...action.patch },
        distribution: action.patch.startingStackUnits != null ? null : state.distribution,
      });

    case 'setPrizeSplit':
      return touch({ ...state, tournament: { ...state.tournament, prizeSplit: action.split } });

    case 'setDistributionMode':
      return touch({ ...state, distributionMode: action.mode, distribution: null });

    case 'setReserveStacks':
      return touch({ ...state, reserveStacks: Math.max(0, action.count), distribution: null });

    case 'runDistribution': {
      const blinds = currentBlinds(state);
      const result = distribute({
        chipSet: state.chipSet,
        players: state.players.map((p) => ({
          id: p.id,
          targetUnits: stackUnitsFor(state, p.buyInCents),
        })),
        mode: state.distributionMode,
        reserveStacks: state.reserveStacks,
        smallBlind: blinds.smallBlind,
        bigBlind: blinds.bigBlind,
      });
      return touch({ ...state, distribution: result });
    }

    case 'startGame': {
      const now = Date.now();
      const stacks = new Map(state.distribution?.stacks.map((s) => [s.playerId, s.counts]) ?? []);
      const ledger: LedgerEntry[] = state.players.map((p) => ({
        id: uid('entry'),
        playerId: p.id,
        kind: 'buyin',
        amountCents: p.buyInCents,
        chips: stacks.get(p.id) ?? {},
        at: now,
      }));
      return touch({
        ...state,
        phase: 'game',
        ledger,
        clock: { levelIndex: 0, runningSince: null, remainingMs: levelDurationMs(state, 0) },
      });
    }

    case 'rebuy': {
      const blinds = currentBlinds(state);
      const stack = rebuyStack({
        chipSet: state.chipSet,
        alreadyHandedOut: chipsHandedOut(state.ledger),
        targetUnits: action.stackUnits,
        mode: state.distributionMode,
        smallBlind: blinds.smallBlind,
        bigBlind: blinds.bigBlind,
      });
      const kind = state.format === 'tournament' && action.amountCents === state.tournament.addOnCents
        ? 'addon'
        : 'rebuy';
      return touch({
        ...state,
        ledger: [
          ...state.ledger,
          {
            id: uid('entry'),
            playerId: action.playerId,
            kind,
            amountCents: action.amountCents,
            chips: stack.counts,
            at: Date.now(),
            note: stack.exact ? undefined : 'Chips left in the box could not make this exactly.',
          },
        ],
      });
    }

    case 'cashOut':
      return touch({
        ...state,
        ledger: [
          ...state.ledger,
          {
            id: uid('entry'),
            playerId: action.playerId,
            kind: 'cashout',
            amountCents: action.amountCents,
            chips: action.chips,
            at: Date.now(),
          },
        ],
        players: state.players.map((p) =>
          p.id === action.playerId && action.leave ? { ...p, leftAt: Date.now() } : p,
        ),
      });

    case 'undoLedger': {
      const entry = state.ledger.find((e) => e.id === action.entryId);
      return touch({
        ...state,
        ledger: state.ledger.filter((e) => e.id !== action.entryId),
        players:
          entry?.kind === 'cashout'
            ? state.players.map((p) => (p.id === entry.playerId ? { ...p, leftAt: null } : p))
            : state.players,
      });
    }

    case 'toggleElimination': {
      const busted = state.eliminations.includes(action.playerId);
      return touch({
        ...state,
        eliminations: busted
          ? state.eliminations.filter((id) => id !== action.playerId)
          : [...state.eliminations, action.playerId],
      });
    }

    case 'retireColor':
      return touch({
        ...state,
        retiredColorIds: state.retiredColorIds.includes(action.colorId)
          ? state.retiredColorIds.filter((id) => id !== action.colorId)
          : [...state.retiredColorIds, action.colorId],
      });

    case 'clockStart':
      if (state.clock.runningSince) return state;
      return { ...state, clock: { ...state.clock, runningSince: Date.now() } };

    case 'clockPause': {
      if (!state.clock.runningSince) return state;
      const elapsed = Date.now() - state.clock.runningSince;
      return {
        ...state,
        clock: {
          ...state.clock,
          runningSince: null,
          remainingMs: Math.max(0, state.clock.remainingMs - elapsed),
        },
      };
    }

    case 'clockGoto': {
      const index = Math.max(0, Math.min(action.index, state.tournament.levels.length - 1));
      return {
        ...state,
        clock: {
          levelIndex: index,
          // Keep running across a level change so the game doesn't stall.
          runningSince: state.clock.runningSince ? Date.now() : null,
          remainingMs: levelDurationMs(state, index),
        },
      };
    }

    case 'clockAdjust': {
      const base = state.clock.runningSince
        ? state.clock.remainingMs - (Date.now() - state.clock.runningSince)
        : state.clock.remainingMs;
      return {
        ...state,
        clock: {
          ...state.clock,
          runningSince: state.clock.runningSince ? Date.now() : null,
          remainingMs: Math.max(0, base + action.deltaMs),
        },
      };
    }

    case 'clockReset':
      return {
        ...state,
        clock: {
          levelIndex: state.clock.levelIndex,
          runningSince: null,
          remainingMs: levelDurationMs(state, state.clock.levelIndex),
        },
      };

    case 'setPayoutMode':
      return touch({
        ...state,
        payout: { ...state.payout, entryMode: action.mode, computed: false },
      });

    case 'setPayoutChips': {
      const existing = state.payout.chipCounts[action.playerId] ?? {};
      return touch({
        ...state,
        payout: {
          ...state.payout,
          computed: false,
          chipCounts: {
            ...state.payout.chipCounts,
            [action.playerId]: { ...existing, [action.colorId]: action.count },
          },
        },
      });
    }

    case 'setPayoutTotal':
      return touch({
        ...state,
        payout: {
          ...state.payout,
          computed: false,
          totals: { ...state.payout.totals, [action.playerId]: action.units },
        },
      });

    case 'setResolution':
      return touch({ ...state, payout: { ...state.payout, resolution: action.resolution } });

    case 'setPayoutComputed':
      return touch({ ...state, payout: { ...state.payout, computed: action.computed } });

    case 'clearPayoutEntries':
      return touch({
        ...state,
        payout: { ...state.payout, chipCounts: {}, totals: {}, computed: false },
      });

    default:
      return state;
  }
}

/** Chip units a player is holding, from whichever entry mode the host is using. */
export function payoutUnitsFor(state: GameState, playerId: string): number {
  if (state.payout.entryMode === 'total') return state.payout.totals[playerId] ?? 0;
  const counts = state.payout.chipCounts[playerId] ?? {};
  return activeColors(state.chipSet)
    .filter((c) => !state.retiredColorIds.includes(c.id))
    .reduce((sum, c) => sum + (counts[c.id] ?? 0) * c.value!, 0);
}
