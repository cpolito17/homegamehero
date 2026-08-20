/**
 * Test harness for CALCULATION_TEST_SUITE.md.
 *
 * Drives the real reducer and the real payout engine along the same path the
 * Payout phase uses, so a case here exercises what the browser exercises. The
 * oracles in the suite document are independent of the implementation: when one
 * disagrees with the app, the app is what changes.
 */
import { computeCashPayout, type CashPayoutResult } from '@/lib/payout';
import { moneyIn, moneyOut, totalMoneyIn } from '@/lib/ledger';
import type { ChipScale } from '@/lib/money';
import type { ChipCount, ChipSet, DistributionMode, GameState, PrizeSlot } from '@/lib/types';
import { createGame } from '@/state/defaults';
import { payoutUnitsFor, reducer, stackUnitsFor, type Action } from '@/state/reducer';

export const DOLLAR: ChipScale = { kind: 'dollar' };
export const points = (unitsPerDollar: number): ChipScale => ({ kind: 'points', unitsPerDollar });

/** Chip colour spec: [label, value in chip units, quantity]. */
export type ColorSpec = [string, number, number];

/** Standard dollar set from the suite: 25c/$1/$5/$25. */
export const STANDARD_SET: ColorSpec[] = [
  ['White', 25, 200],
  ['Red', 100, 150],
  ['Green', 500, 100],
  ['Black', 2500, 50],
];

/** Fine dollar set: 1c/3c/7c/11c, deliberately awkward denominations. */
export const FINE_SET: ColorSpec[] = [
  ['White', 1, 2000],
  ['Red', 3, 500],
  ['Green', 7, 300],
  ['Black', 11, 100],
];

/** Points set: 25/100/500/2500 point chips. */
export const POINTS_SET: ColorSpec[] = [
  ['White', 25, 200],
  ['Red', 100, 150],
  ['Green', 500, 100],
  ['Black', 2500, 50],
];

export class Game {
  state: GameState;

  constructor(scale: ChipScale = DOLLAR) {
    this.state = createGame(scale);
  }

  dispatch(...actions: Action[]): this {
    for (const action of actions) this.state = reducer(this.state, action);
    return this;
  }

  /** Replace the chip set wholesale. Colour ids are derived from the label. */
  chips(spec: ColorSpec[]): this {
    const chipSet: ChipSet = {
      ...this.state.chipSet,
      hasPrintedValues: true,
      colors: spec.map(([label, value, quantity], i) => ({
        id: `c${i}-${label.toLowerCase().replace(/\s+/g, '-')}`,
        label,
        hex: '#888888',
        quantity,
        value,
      })),
    };
    return this.dispatch({ type: 'setChipSet', chipSet });
  }

  /** Colour id by label, for building chip counts in a case. */
  colorId(label: string): string {
    const color = this.state.chipSet.colors.find((c) => c.label === label);
    if (!color) throw new Error(`no colour labelled ${label}`);
    return color.id;
  }

  /** Seat exactly these players, replacing whoever the default game created. */
  players(buyIns: number[], names?: string[]): this {
    for (const player of [...this.state.players]) {
      this.dispatch({ type: 'removePlayer', id: player.id });
    }
    buyIns.forEach((cents, i) => {
      this.dispatch({ type: 'addPlayer', name: names?.[i] ?? `P${i + 1}`, buyInCents: cents });
    });
    return this;
  }

  id(index: number): string {
    const player = this.state.players[index];
    if (!player) throw new Error(`no player at index ${index}`);
    return player.id;
  }

  blinds(smallBlind: number, bigBlind: number): this {
    return this.dispatch({ type: 'patchCash', patch: { smallBlind, bigBlind } });
  }

  mode(mode: DistributionMode): this {
    return this.dispatch({ type: 'setDistributionMode', mode });
  }

  reserve(count: number): this {
    return this.dispatch({ type: 'setReserveStacks', count });
  }

  distribute(): this {
    return this.dispatch({ type: 'runDistribution' });
  }

  start(): this {
    return this.dispatch({ type: 'startGame' });
  }

  rebuy(index: number, cents: number): this {
    return this.dispatch({
      type: 'rebuy',
      playerId: this.id(index),
      amountCents: cents,
      stackUnits: stackUnitsFor(this.state, cents),
    });
  }

  cashOut(index: number, cents: number, chips: ChipCount = {}, leave = true): this {
    return this.dispatch({
      type: 'cashOut',
      playerId: this.id(index),
      amountCents: cents,
      chips,
      leave,
    });
  }

  bust(index: number): this {
    return this.dispatch({ type: 'toggleElimination', playerId: this.id(index) });
  }

  /** Final count entered as a total in chip units, the "Enter a total" mode. */
  totals(units: number[]): this {
    this.dispatch({ type: 'setPayoutMode', mode: 'total' });
    units.forEach((value, i) => {
      this.dispatch({ type: 'setPayoutTotal', playerId: this.id(i), units: value });
    });
    return this;
  }

  /** Final count entered colour by colour, the "Count by colour" mode. */
  counts(perPlayer: Record<string, number>[]): this {
    this.dispatch({ type: 'setPayoutMode', mode: 'chips' });
    perPlayer.forEach((byLabel, i) => {
      for (const [label, count] of Object.entries(byLabel)) {
        this.dispatch({
          type: 'setPayoutChips',
          playerId: this.id(i),
          colorId: this.colorId(label),
          count,
        });
      }
    });
    return this;
  }

  resolution(resolution: 'none' | 'scale' | 'accept'): this {
    return this.dispatch({ type: 'setResolution', resolution });
  }

  prizeSplit(split: PrizeSlot[]): this {
    return this.dispatch({ type: 'setPrizeSplit', split });
  }

  /** The payout exactly as the Payout phase computes it. */
  payout(): CashPayoutResult {
    return computeCashPayout({
      players: this.state.players.map((p) => ({
        id: p.id,
        chipUnits: payoutUnitsFor(this.state, p.id),
        buyInCents: moneyIn(this.state.ledger, p.id),
        cashedOutCents: moneyOut(this.state.ledger, p.id),
        left: Boolean(p.leftAt),
      })),
      scale: this.state.scale,
      resolution: this.state.payout.resolution,
    });
  }

  /** Payout in player order, in cents. The number every case checks. */
  cashouts(): number[] {
    return this.payout().lines.map((l) => l.payoutCents);
  }

  /** Tournament prize pool, as the Payout phase computes it. */
  pool(): number {
    return totalMoneyIn(this.state.ledger);
  }

  /** Chips the box actually issued to a player across every entry. */
  chipsIssued(index: number): ChipCount {
    const id = this.id(index);
    const out: ChipCount = {};
    for (const entry of this.state.ledger) {
      if (entry.playerId !== id) continue;
      const sign = entry.kind === 'cashout' ? -1 : 1;
      for (const [colorId, count] of Object.entries(entry.chips)) {
        out[colorId] = (out[colorId] ?? 0) + sign * count;
      }
    }
    return out;
  }
}

/** Every transfer applied to every net position must leave each player at zero. */
export function settlementClears(result: CashPayoutResult): boolean {
  const balance = new Map<string, number>();
  for (const line of result.lines) balance.set(line.playerId, line.netCents);
  for (const t of result.transfers) {
    if (balance.has(t.fromPlayerId)) {
      balance.set(t.fromPlayerId, balance.get(t.fromPlayerId)! + t.cents);
    }
    if (balance.has(t.toPlayerId)) {
      balance.set(t.toPlayerId, balance.get(t.toPlayerId)! - t.cents);
    }
  }
  return [...balance.values()].every((v) => v === 0);
}
