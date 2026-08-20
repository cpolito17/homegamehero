import type {
  ChipCount,
  ChipSet,
  DistributionMode,
  DistributionResult,
  Notice,
  StackPlan,
} from './types';
import { activeColors } from './chips';
import { fillExact, fillRemainder, type FillItem } from './knapsack';

export interface DistributeInput {
  chipSet: ChipSet;
  players: { id: string; targetUnits: number }[];
  mode: DistributionMode;
  /** Extra full stacks to hold back so the first rebuy has chips to pay out. */
  reserveStacks: number;
  smallBlind: number;
  bigBlind: number;
}

/** Blind coverage and small-chip ceiling for each profile. */
const PROFILE = {
  balanced: { orbits: 10, maxSmallShare: 0.3 },
  efficient: { orbits: 4, maxSmallShare: 0.15 },
  deep: { orbits: 10, maxSmallShare: 0.3 },
} as const;

/**
 * How many of the smallest chip a stack should open with.
 *
 * This is an absolute number, not a share of the stack: posting blinds costs the
 * same whether you sat down for $20 or $60. A stack with no small chips is
 * exactly correct in value and useless at the table.
 */
function smallChipFloor(
  target: number,
  items: FillItem[],
  mode: DistributionMode,
  smallBlind: number,
  bigBlind: number,
): number {
  const smallest = items[0];
  if (!smallest || smallest.value <= 0) return 0;
  const profile = PROFILE[mode];
  const orbitCost = smallBlind + bigBlind;
  const byBlinds = orbitCost > 0 ? orbitCost * profile.orbits : target * profile.maxSmallShare;
  const value = Math.min(target * profile.maxSmallShare, byBlinds);
  return Math.min(smallest.cap, Math.floor(value / smallest.value));
}

/**
 * Lays out a stack shape: a floor of small chips, then a ramp upward so the
 * stack is bettable at every size rather than being one big chip.
 */
function shapePreset(
  smallCount: number,
  target: number,
  items: FillItem[],
  ramp: boolean,
): number[] {
  const counts = new Array<number>(items.length).fill(0);
  if (items.length === 0) return counts;
  counts[0] = smallCount;

  const remaining = target - smallCount * items[0]!.value;
  if (!ramp || items.length === 1 || remaining <= 0) return counts;

  let weightSum = 0;
  for (let i = 1; i < items.length; i++) weightSum += i + 1;

  for (let i = 1; i < items.length; i++) {
    const item = items[i]!;
    if (item.value <= 0 || item.cap <= 0) continue;
    const share = (remaining * (i + 1)) / weightSum;
    counts[i] = Math.min(item.cap, Math.floor(share / item.value));
  }
  return counts;
}

/** How far we will walk the small-chip floor down looking for an exact fit. */
const RELAX_LIMIT = 64;

function buildStack(
  target: number,
  items: FillItem[],
  mode: DistributionMode,
  smallBlind: number,
  bigBlind: number,
): { counts: number[]; total: number; exact: boolean } {
  if (items.length === 0) return { counts: [], total: 0, exact: target === 0 };

  // A tall stack is a max-chip fill by definition: it already leans on the
  // smallest denominations as hard as the box allows.
  if (mode === 'deep') {
    const maxed = fillExact(target, items, 'max');
    if (maxed.exact) return maxed;
  }

  const desired = smallChipFloor(target, items, mode, smallBlind, bigBlind);

  // Committing to a small-chip floor can strand a residual that the remaining
  // denominations cannot express (spend every 25c chip and 1550 is unreachable
  // from 100s and 500s). Walk the floor down until the rest fits exactly.
  for (const ramp of mode === 'balanced' ? [true, false] : [false]) {
    const lowest = Math.max(0, desired - RELAX_LIMIT);
    for (let n = desired; n >= lowest; n--) {
      const filled = fillRemainder(target, items, shapePreset(n, target, items, ramp), 'min');
      if (filled) return filled;
    }
  }

  return fillExact(target, items, mode === 'deep' ? 'max' : 'min');
}

function toChipCount(colorIds: string[], counts: number[]): ChipCount {
  const out: ChipCount = {};
  colorIds.forEach((id, i) => {
    const n = counts[i] ?? 0;
    if (n > 0) out[id] = n;
  });
  return out;
}

/** The buy-in most players are sitting down with. Used to size the reserve. */
export function standardStack(targets: number[]): number {
  if (targets.length === 0) return 0;
  const tally = new Map<number, number>();
  for (const t of targets) tally.set(t, (tally.get(t) ?? 0) + 1);
  let best = targets[0]!;
  let bestCount = 0;
  for (const [value, count] of tally) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function distribute(input: DistributeInput): DistributionResult {
  const notices: Notice[] = [];
  const colors = activeColors(input.chipSet);
  const colorIds = colors.map((c) => c.id);
  const values = colors.map((c) => c.value!);

  const targets = input.players.map((p) => p.targetUnits);
  const standard = standardStack(targets);

  const empty: DistributionResult = {
    mode: input.mode,
    stacks: [],
    reserve: {},
    leftover: {},
    reserveStacks: 0,
    notices,
    feasible: false,
    standardStackUnits: standard,
  };

  if (colors.length === 0) {
    notices.push({ level: 'error', message: 'Set a value and a quantity for at least one colour.' });
    return empty;
  }
  if (input.players.length === 0) {
    notices.push({ level: 'error', message: 'Add at least one player.' });
    return empty;
  }

  const remaining: number[] = colors.map((c) => c.quantity);
  const reserveCount = Math.max(0, Math.round(input.reserveStacks));

  // Every colour is shared out in proportion to how much of the table's money a
  // stack represents, so one big buy-in can't drain the small chips.
  const totalDemand =
    targets.reduce((a, b) => a + b, 0) + reserveCount * standard || 1;
  const totalStacks = input.players.length + reserveCount || 1;

  const solveOne = (target: number): { counts: number[]; total: number; exact: boolean } => {
    const fairItems: FillItem[] = values.map((value, i) => {
      const owned = colors[i]!.quantity;
      // The smallest chip is split evenly: an orbit of blinds costs the same
      // whether you sat down for $20 or $60, so a big stack has no claim on more
      // change than anyone else. Everything above it splits by stack size.
      const share =
        i === 0
          ? Math.floor(owned / totalStacks)
          : Math.floor((owned * target) / totalDemand);
      return { value, cap: Math.min(remaining[i]!, share) };
    });

    let result = buildStack(target, fairItems, input.mode, input.smallBlind, input.bigBlind);

    // Fair share was too tight to hit the number exactly, so let this stack reach
    // into what's actually left rather than handing out a wrong stack.
    if (!result.exact) {
      const greedyItems: FillItem[] = values.map((value, i) => ({ value, cap: remaining[i]! }));
      const retry = buildStack(target, greedyItems, input.mode, input.smallBlind, input.bigBlind);
      if (retry.exact || retry.total > result.total) result = retry;
    }

    result.counts.forEach((n, i) => {
      remaining[i] = Math.max(0, remaining[i]! - n);
    });
    return result;
  };

  // Biggest stacks first: they are the hardest to make and the most likely to
  // run into a shortage.
  const order = input.players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => b.player.targetUnits - a.player.targetUnits);

  const stacks: StackPlan[] = new Array(input.players.length);
  for (const { player, index } of order) {
    const solved = solveOne(player.targetUnits);
    stacks[index] = {
      playerId: player.id,
      targetUnits: player.targetUnits,
      counts: toChipCount(colorIds, solved.counts),
      totalUnits: solved.total,
      chipCount: solved.counts.reduce((a, b) => a + b, 0),
      exact: solved.exact,
    };
  }

  const reserve: ChipCount = {};
  let reserveMade = 0;
  for (let i = 0; i < reserveCount; i++) {
    const solved = solveOne(standard);
    if (!solved.exact) {
      // Put the chips back: a partial reserve stack isn't a rebuy.
      solved.counts.forEach((n, idx) => {
        remaining[idx] = remaining[idx]! + n;
      });
      break;
    }
    reserveMade++;
    solved.counts.forEach((n, idx) => {
      if (n > 0) reserve[colorIds[idx]!] = (reserve[colorIds[idx]!] ?? 0) + n;
    });
  }

  const leftover: ChipCount = {};
  colors.forEach((c, i) => {
    if (remaining[i]! > 0) leftover[c.id] = remaining[i]!;
  });

  // ---- notices -----------------------------------------------------------
  const short = stacks.filter((s) => !s.exact);
  if (short.length) {
    notices.push({
      level: 'error',
      message: `${short.length} ${short.length === 1 ? 'stack' : 'stacks'} can't be made exactly from your chips. Add chips, adjust the buy-in, or change denominations.`,
    });
  }

  if (reserveCount > 0 && reserveMade < reserveCount) {
    notices.push({
      level: 'warn',
      message:
        reserveMade === 0
          ? "No chips left over for rebuys. The first rebuy will have nothing to pay out."
          : `Only ${reserveMade} of ${reserveCount} reserve stacks fit. Rebuys past that will run the box dry.`,
    });
  }

  const smallestId = colorIds[0];
  if (smallestId && stacks.length) {
    const worstSmall = Math.min(...stacks.map((s) => s.counts[smallestId] ?? 0));
    if (worstSmall < 8 && input.bigBlind > 0) {
      notices.push({
        level: 'warn',
        message: `Some stacks start with fewer than 8 ${colors[0]!.label.toLowerCase()} chips. Expect to make change early.`,
      });
    }
  }

  const avgChips = stacks.reduce((a, s) => a + s.chipCount, 0) / (stacks.length || 1);
  if (avgChips > 0 && avgChips < 15) {
    notices.push({
      level: 'info',
      message: `About ${Math.round(avgChips)} chips per stack. That's thin. Try the Deep stack profile, or add a smaller denomination.`,
    });
  }

  return {
    mode: input.mode,
    stacks,
    reserve,
    leftover,
    reserveStacks: reserveMade,
    notices,
    feasible: short.length === 0,
    standardStackUnits: standard,
  };
}

/**
 * Chips for a single mid-game rebuy, taken from what is physically left in the box.
 */
export function rebuyStack(opts: {
  chipSet: ChipSet;
  alreadyHandedOut: ChipCount;
  targetUnits: number;
  mode: DistributionMode;
  smallBlind: number;
  bigBlind: number;
}): { counts: ChipCount; exact: boolean; totalUnits: number } {
  const colors = activeColors(opts.chipSet);
  const items: FillItem[] = colors.map((c) => ({
    value: c.value!,
    cap: Math.max(0, c.quantity - (opts.alreadyHandedOut[c.id] ?? 0)),
  }));

  const solved = buildStack(opts.targetUnits, items, opts.mode, opts.smallBlind, opts.bigBlind);
  return {
    counts: toChipCount(
      colors.map((c) => c.id),
      solved.counts,
    ),
    exact: solved.exact,
    totalUnits: solved.total,
  };
}
