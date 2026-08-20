import type { ChipCount, GameState, LedgerEntry, Player } from './types';
import { addCounts } from './chips';

/** Money a player has put on the table: initial buy-in plus every rebuy and add-on. */
export function moneyIn(ledger: LedgerEntry[], playerId: string): number {
  return ledger
    .filter((e) => e.playerId === playerId && e.kind !== 'cashout')
    .reduce((sum, e) => sum + e.amountCents, 0);
}

/** Money already handed back to a player mid-game. */
export function moneyOut(ledger: LedgerEntry[], playerId: string): number {
  return ledger
    .filter((e) => e.playerId === playerId && e.kind === 'cashout')
    .reduce((sum, e) => sum + e.amountCents, 0);
}

export function totalMoneyIn(ledger: LedgerEntry[]): number {
  return ledger.filter((e) => e.kind !== 'cashout').reduce((s, e) => s + e.amountCents, 0);
}

export function totalMoneyOut(ledger: LedgerEntry[]): number {
  return ledger.filter((e) => e.kind === 'cashout').reduce((s, e) => s + e.amountCents, 0);
}

/**
 * Cash still represented by chips on the table: everything paid in, less
 * everything already paid back out to players who left.
 */
export function tableStakeCents(ledger: LedgerEntry[]): number {
  return totalMoneyIn(ledger) - totalMoneyOut(ledger);
}

/** Every chip that has left the box, net of chips handed back on a cash-out. */
export function chipsHandedOut(ledger: LedgerEntry[]): ChipCount {
  const out: ChipCount = {};
  for (const entry of ledger) {
    const sign = entry.kind === 'cashout' ? -1 : 1;
    for (const [colorId, count] of Object.entries(entry.chips)) {
      out[colorId] = (out[colorId] ?? 0) + sign * count;
    }
  }
  return out;
}

export function rebuyCount(ledger: LedgerEntry[], playerId?: string): number {
  return ledger.filter(
    (e) => (e.kind === 'rebuy' || e.kind === 'addon') && (!playerId || e.playerId === playerId),
  ).length;
}

export function activePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.leftAt);
}

export function playerChipsReceived(ledger: LedgerEntry[], playerId: string): ChipCount {
  return ledger
    .filter((e) => e.playerId === playerId && e.kind !== 'cashout')
    .reduce<ChipCount>((acc, e) => addCounts(acc, e.chips), {});
}
