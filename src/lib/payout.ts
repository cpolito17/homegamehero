import type { Discrepancy, Notice, PrizeSlot } from './types';
import { allocateProportional, unitsToCents, type ChipScale } from './money';

export interface PayoutLine {
  playerId: string;
  /** Chip units counted in front of this player. */
  chipUnits: number;
  /** What those chips are worth before any discrepancy handling. */
  rawCents: number;
  /** What the player actually gets paid. */
  payoutCents: number;
  /** Everything they put on the table. */
  buyInCents: number;
  /** Payout minus buy-ins. The number everyone actually cares about. */
  netCents: number;
  /** True for players who cashed out and left, already settled in cash. */
  settled: boolean;
}

/**
 * Stand-in counterparty for money that no player is on the hook for.
 *
 * Only appears when the counted chips disagree with the cash that went in and
 * the host has not resolved the gap. Without it the settlement would quietly
 * drop a creditor, which is how a winner ends up owed money by nobody.
 */
export const POT_ID = '__pot__';

export interface Transfer {
  /** A player id, or POT_ID when the pot itself is covering the difference. */
  fromPlayerId: string;
  /** A player id, or POT_ID when the leftover stays in the pot. */
  toPlayerId: string;
  cents: number;
}

export interface CashPayoutResult {
  lines: PayoutLine[];
  /** Money on the table: everything paid in, less anything already paid out. */
  potCents: number;
  /** What the counted chips say the table is worth. */
  countedCents: number;
  /** countedCents - potCents. Zero is the happy path and it rarely happens. */
  deltaCents: number;
  transfers: Transfer[];
  notices: Notice[];
}

export interface CashPayoutInput {
  players: {
    id: string;
    chipUnits: number;
    buyInCents: number;
    /** Cash already taken off the table by this player. */
    cashedOutCents: number;
    left: boolean;
  }[];
  scale: ChipScale;
  resolution: Discrepancy;
}

/**
 * Turns chip counts into dollar amounts.
 *
 * The counted chips almost never add up to the money that went in. One rolls
 * under the table, someone pockets a souvenir, a stack gets miscounted. This
 * refuses to invent or destroy money silently: it reports the gap and pays out
 * against whichever total the host chose to trust.
 */
export function computeCashPayout(input: CashPayoutInput): CashPayoutResult {
  const notices: Notice[] = [];
  const remaining = input.players.filter((p) => !p.left);

  const potCents = input.players.reduce((s, p) => s + p.buyInCents - p.cashedOutCents, 0);
  const totalUnits = remaining.reduce((s, p) => s + Math.max(0, p.chipUnits), 0);
  const countedCents = unitsToCents(totalUnits, input.scale);
  const deltaCents = countedCents - potCents;

  const target = input.resolution === 'scale' ? potCents : countedCents;
  const shares = allocateProportional(
    Math.max(0, target),
    remaining.map((p) => Math.max(0, p.chipUnits)),
  );

  const payoutByPlayer = new Map<string, number>();
  remaining.forEach((p, i) => payoutByPlayer.set(p.id, shares[i] ?? 0));

  const lines: PayoutLine[] = input.players.map((p) => {
    const payoutCents = p.left ? p.cashedOutCents : (payoutByPlayer.get(p.id) ?? 0);
    return {
      playerId: p.id,
      chipUnits: p.left ? 0 : p.chipUnits,
      rawCents: p.left ? p.cashedOutCents : unitsToCents(p.chipUnits, input.scale),
      payoutCents,
      buyInCents: p.buyInCents,
      netCents: payoutCents - p.buyInCents,
      settled: p.left,
    };
  });

  if (deltaCents !== 0 && input.resolution === 'none') {
    notices.push({
      level: deltaCents > 0 ? 'warn' : 'error',
      message:
        deltaCents > 0
          ? "The chips on the table are worth more than the money that went in. Recount, or check whether a buy-in went unrecorded."
          : "The chips on the table are worth less than the money that went in. Chips are missing, so recount before paying anyone.",
    });
  }
  if (deltaCents !== 0 && input.resolution === 'scale') {
    notices.push({
      level: 'info',
      message: 'Payouts scaled to match the cash actually in the pot, so the total comes out even.',
    });
  }
  if (deltaCents !== 0 && input.resolution === 'accept') {
    notices.push({
      level: 'warn',
      message: 'Paying the chip count as-is. The totals will not balance against the pot.',
    });
  }

  return {
    lines,
    potCents,
    countedCents,
    deltaCents,
    transfers: settleAll(lines),
    notices,
  };
}

/**
 * Settles a whole table, including anyone who cashed out and left.
 *
 * Every player's net has to land somewhere. A player who left is still owed
 * their win or still owes their loss, so leaving them out of the matching
 * breaks the zero-sum and strands whoever they were going to be paid by.
 *
 * If the nets still do not cancel, the books genuinely do not balance: the chips
 * counted are worth more or less than the cash that went in. Rather than drop
 * the odd money, the pot takes the other side of it so the difference is visible.
 */
export function settleAll(lines: { playerId: string; netCents: number }[]): Transfer[] {
  const imbalance = lines.reduce((s, l) => s + l.netCents, 0);
  const withPot =
    imbalance === 0 ? lines : [...lines, { playerId: POT_ID, netCents: -imbalance }];
  return settle(withPot);
}

/**
 * Reduces net positions to the fewest payments that clear them.
 *
 * Repeatedly matching the biggest winner with the biggest loser settles a table
 * in at most n-1 payments, which is the difference between two Venmos and six.
 */
export function settle(lines: { playerId: string; netCents: number }[]): Transfer[] {
  const creditors = lines
    .filter((l) => l.netCents > 0)
    .map((l) => ({ id: l.playerId, amount: l.netCents }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = lines
    .filter((l) => l.netCents < 0)
    .map((l) => ({ id: l.playerId, amount: -l.netCents }))
    .sort((a, b) => b.amount - a.amount);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  // Guard against a pathological loop if the numbers ever fail to converge.
  let guard = creditors.length + debtors.length + 1;

  while (ci < creditors.length && di < debtors.length && guard-- > 0) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;
    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > 0) {
      transfers.push({ fromPlayerId: debtor.id, toPlayerId: creditor.id, cents: amount });
      creditor.amount -= amount;
      debtor.amount -= amount;
      guard = creditors.length + debtors.length + 1;
    }
    if (creditor.amount === 0) ci++;
    if (debtor.amount === 0) di++;
  }

  return transfers;
}

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

export interface PrizeLine {
  place: number;
  cents: number;
  playerId: string | null;
}

export function prizeSplitNotices(split: PrizeSlot[]): Notice[] {
  const total = split.reduce((s, p) => s + p.percent, 0);
  const rounded = Math.round(total * 100) / 100;
  if (split.length === 0) {
    return [{ level: 'error', message: 'Add at least one paying place.' }];
  }
  if (rounded !== 100) {
    return [
      {
        level: 'error',
        message: `Payout percentages add up to ${rounded}%, not 100%.`,
      },
    ];
  }
  return [];
}

/**
 * Splits the prize pool across places.
 *
 * Percentages are rounded with the largest-remainder method so the prizes add up
 * to the pool exactly, with no stray cent left in the box and no prize a dollar short.
 */
export function computePrizes(opts: {
  poolCents: number;
  split: PrizeSlot[];
  /** Player ids by finishing position, winner first. */
  finishOrder: string[];
}): { prizes: PrizeLine[]; notices: Notice[] } {
  const notices = prizeSplitNotices(opts.split);
  const ordered = opts.split.slice().sort((a, b) => a.place - b.place);
  const amounts = allocateProportional(
    Math.max(0, opts.poolCents),
    ordered.map((s) => Math.max(0, s.percent)),
  );

  const prizes: PrizeLine[] = ordered.map((slot, i) => ({
    place: slot.place,
    cents: amounts[i] ?? 0,
    playerId: opts.finishOrder[slot.place - 1] ?? null,
  }));

  if (opts.finishOrder.length && ordered.length > opts.finishOrder.length) {
    notices.push({
      level: 'warn',
      message: `You're paying ${ordered.length} places but only ${opts.finishOrder.length} players finished.`,
    });
  }

  return { prizes, notices };
}

/**
 * Finishing order for a tournament: the last player standing first, then the
 * bust order in reverse.
 */
export function finishOrderFrom(eliminations: string[], allPlayerIds: string[]): string[] {
  const busted = new Set(eliminations);
  const survivors = allPlayerIds.filter((id) => !busted.has(id));
  return [...survivors, ...eliminations.slice().reverse()];
}
