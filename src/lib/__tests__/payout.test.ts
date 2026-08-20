import { describe, expect, it } from 'vitest';
import {
  computeCashPayout,
  computePrizes,
  finishOrderFrom,
  prizeSplitNotices,
  settle,
} from '../payout';
import type { CashPayoutInput } from '../payout';

const DOLLAR = { kind: 'dollar' } as const;

function table(chipUnits: number[], buyIns: number[]): CashPayoutInput {
  return {
    players: chipUnits.map((units, i) => ({
      id: `p${i}`,
      chipUnits: units,
      buyInCents: buyIns[i]!,
      cashedOutCents: 0,
      left: false,
    })),
    scale: DOLLAR,
    resolution: 'none',
  };
}

describe('computeCashPayout', () => {
  it('pays out the chip count when the table balances', () => {
    const result = computeCashPayout(table([3000, 1000, 2500, 3500], [2000, 2000, 2000, 4000]));
    expect(result.potCents).toBe(10_000);
    expect(result.countedCents).toBe(10_000);
    expect(result.deltaCents).toBe(0);
    expect(result.lines.map((l) => l.payoutCents)).toEqual([3000, 1000, 2500, 3500]);
    expect(result.lines.map((l) => l.netCents)).toEqual([1000, -1000, 500, -500]);
  });

  it('flags a shortfall instead of quietly paying it out', () => {
    const result = computeCashPayout(table([3000, 1000, 2000, 3500], [2000, 2000, 2000, 4000]));
    expect(result.deltaCents).toBe(-500);
    expect(result.notices.some((n) => n.level === 'error')).toBe(true);
  });

  it('scales payouts to the real pot when asked', () => {
    const input = { ...table([3000, 1000, 2000, 3500], [2000, 2000, 2000, 4000]), resolution: 'scale' as const };
    const result = computeCashPayout(input);
    const paid = result.lines.reduce((s, l) => s + l.payoutCents, 0);
    expect(paid).toBe(result.potCents);
    // Everyone keeps their relative share.
    expect(result.lines[0]!.payoutCents).toBeGreaterThan(result.lines[2]!.payoutCents);
  });

  it('scales to the exact cent with an awkward split', () => {
    const input = { ...table([333, 333, 334], [500, 500, 500]), resolution: 'scale' as const };
    const result = computeCashPayout(input);
    expect(result.lines.reduce((s, l) => s + l.payoutCents, 0)).toBe(1500);
  });

  it('leaves players who cashed out early alone', () => {
    const result = computeCashPayout({
      players: [
        { id: 'a', chipUnits: 4000, buyInCents: 2000, cashedOutCents: 0, left: false },
        { id: 'b', chipUnits: 2000, buyInCents: 2000, cashedOutCents: 0, left: false },
        { id: 'c', chipUnits: 0, buyInCents: 2000, cashedOutCents: 0, left: true },
      ],
      scale: DOLLAR,
      resolution: 'none',
    });
    // c took nothing off the table, so the pot is still the full $60.
    expect(result.potCents).toBe(6000);
    expect(result.lines[2]!.settled).toBe(true);
    expect(result.transfers.every((t) => t.fromPlayerId !== 'c' && t.toPlayerId !== 'c')).toBe(true);
  });

  it('removes an early cash-out from the pot', () => {
    const result = computeCashPayout({
      players: [
        { id: 'a', chipUnits: 3000, buyInCents: 2000, cashedOutCents: 0, left: false },
        { id: 'b', chipUnits: 1000, buyInCents: 2000, cashedOutCents: 0, left: false },
        { id: 'c', chipUnits: 0, buyInCents: 2000, cashedOutCents: 2000, left: true },
      ],
      scale: DOLLAR,
      resolution: 'none',
    });
    expect(result.potCents).toBe(4000);
    expect(result.deltaCents).toBe(0);
  });

  it('converts points through the exchange rate', () => {
    const result = computeCashPayout({
      players: [
        { id: 'a', chipUnits: 1500, buyInCents: 2000, cashedOutCents: 0, left: false },
        { id: 'b', chipUnits: 500, buyInCents: 2000, cashedOutCents: 0, left: false },
      ],
      scale: { kind: 'points', unitsPerDollar: 50 },
      resolution: 'none',
    });
    expect(result.lines[0]!.payoutCents).toBe(3000);
    expect(result.lines[1]!.payoutCents).toBe(1000);
    expect(result.deltaCents).toBe(0);
  });
});

describe('settle', () => {
  it('clears the table and balances to zero', () => {
    const transfers = settle([
      { playerId: 'a', netCents: 1000 },
      { playerId: 'b', netCents: -3000 },
      { playerId: 'c', netCents: 500 },
      { playerId: 'd', netCents: 1500 },
    ]);
    const net = new Map<string, number>();
    for (const t of transfers) {
      net.set(t.toPlayerId, (net.get(t.toPlayerId) ?? 0) + t.cents);
      net.set(t.fromPlayerId, (net.get(t.fromPlayerId) ?? 0) - t.cents);
    }
    expect(net.get('a')).toBe(1000);
    expect(net.get('b')).toBe(-3000);
    expect(net.get('c')).toBe(500);
    expect(net.get('d')).toBe(1500);
  });

  it('needs at most one payment fewer than there are players', () => {
    const transfers = settle([
      { playerId: 'a', netCents: 2000 },
      { playerId: 'b', netCents: -1000 },
      { playerId: 'c', netCents: -1000 },
      { playerId: 'd', netCents: 0 },
    ]);
    expect(transfers.length).toBeLessThanOrEqual(3);
  });

  it('has nothing to do when everyone broke even', () => {
    expect(settle([{ playerId: 'a', netCents: 0 }])).toEqual([]);
  });
});

describe('prize split', () => {
  it('rejects a split that does not add up', () => {
    expect(prizeSplitNotices([{ place: 1, percent: 60 }])).toHaveLength(1);
    expect(prizeSplitNotices([])).toHaveLength(1);
    expect(
      prizeSplitNotices([
        { place: 1, percent: 50 },
        { place: 2, percent: 30 },
        { place: 3, percent: 20 },
      ]),
    ).toHaveLength(0);
  });

  it('pays out the whole pool to the cent', () => {
    const { prizes } = computePrizes({
      poolCents: 18_700,
      split: [
        { place: 1, percent: 50 },
        { place: 2, percent: 30 },
        { place: 3, percent: 20 },
      ],
      finishOrder: ['a', 'b', 'c', 'd'],
    });
    expect(prizes.reduce((s, p) => s + p.cents, 0)).toBe(18_700);
    expect(prizes[0]!.playerId).toBe('a');
    expect(prizes[2]!.playerId).toBe('c');
  });

  it('warns when it is paying more places than there are players', () => {
    const { notices } = computePrizes({
      poolCents: 10_000,
      split: [
        { place: 1, percent: 50 },
        { place: 2, percent: 50 },
      ],
      finishOrder: ['a'],
    });
    expect(notices.some((n) => n.level === 'warn')).toBe(true);
  });
});

describe('finishOrderFrom', () => {
  it('puts the survivor first and the bust order in reverse', () => {
    expect(finishOrderFrom(['d', 'c', 'b'], ['a', 'b', 'c', 'd'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps several survivors ahead of the busted', () => {
    expect(finishOrderFrom(['c'], ['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });
});
