import type { ChipColor, ChipCount, ChipSet, Notice } from './types';
import { gcdAll, uid, type ChipScale } from './money';

/** Standard cash-game denominations, in cents. */
export const DOLLAR_LADDER = [5, 10, 25, 50, 100, 500, 2500, 10000, 50000];

/** Standard tournament chip values, in points. */
export const POINT_LADDER = [5, 25, 100, 500, 1000, 5000, 25000, 100000];

export const PALETTE: { label: string; hex: string }[] = [
  { label: 'White', hex: '#e9e9ec' },
  { label: 'Red', hex: '#d5384a' },
  { label: 'Blue', hex: '#3070d6' },
  { label: 'Green', hex: '#2a9d5c' },
  { label: 'Black', hex: '#26282e' },
  { label: 'Purple', hex: '#8b5cf6' },
  { label: 'Yellow', hex: '#eab308' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Pink', hex: '#ec4899' },
  { label: 'Gray', hex: '#78808f' },
  { label: 'Brown', hex: '#8b5e34' },
  { label: 'Teal', hex: '#14b8a6' },
];

/** Casino convention, in whole dollars / points. */
const CONVENTION: Record<string, number> = {
  white: 1,
  cream: 1,
  red: 5,
  blue: 10,
  green: 25,
  black: 100,
  purple: 500,
  yellow: 1000,
  orange: 2000,
  pink: 5000,
  gray: 5000,
  grey: 5000,
  brown: 5000,
  teal: 2000,
};

export function ladderFor(scale: ChipScale): number[] {
  return scale.kind === 'dollar' ? DOLLAR_LADDER : POINT_LADDER;
}

export function newChipColor(index: number): ChipColor {
  const swatch = PALETTE[index % PALETTE.length]!;
  return { id: uid('color'), label: swatch.label, hex: swatch.hex, quantity: 0, value: null };
}

export function emptyChipSet(): ChipSet {
  return {
    id: uid('set'),
    name: 'My chip set',
    hasPrintedValues: true,
    colors: [0, 1, 2, 3].map(newChipColor),
  };
}

/** Colours that are actually usable: priced and physically present. */
export function activeColors(chipSet: ChipSet): ChipColor[] {
  return chipSet.colors
    .filter((c) => c.value != null && c.value > 0 && c.quantity > 0)
    .sort((a, b) => a.value! - b.value!);
}

export function denominations(chipSet: ChipSet): number[] {
  return activeColors(chipSet).map((c) => c.value!);
}

export function inventoryUnits(chipSet: ChipSet): number {
  return activeColors(chipSet).reduce((sum, c) => sum + c.value! * c.quantity, 0);
}

export function totalChipsOwned(chipSet: ChipSet): number {
  return chipSet.colors.reduce((sum, c) => sum + c.quantity, 0);
}

// ---------------------------------------------------------------------------
// ChipCount helpers
// ---------------------------------------------------------------------------

export function countUnits(counts: ChipCount, chipSet: ChipSet): number {
  let total = 0;
  for (const color of chipSet.colors) {
    const n = counts[color.id] ?? 0;
    if (n && color.value) total += n * color.value;
  }
  return total;
}

export function countChips(counts: ChipCount): number {
  return Object.values(counts).reduce((a, b) => a + b, 0);
}

export function addCounts(a: ChipCount, b: ChipCount): ChipCount {
  const out: ChipCount = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export function subCounts(a: ChipCount, b: ChipCount): ChipCount {
  const out: ChipCount = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) - v;
  return out;
}

export function scaleCounts(a: ChipCount, factor: number): ChipCount {
  const out: ChipCount = {};
  for (const [k, v] of Object.entries(a)) out[k] = v * factor;
  return out;
}

export function isEmptyCount(counts: ChipCount): boolean {
  return Object.values(counts).every((v) => v === 0);
}

/** Inventory left after every ledger entry that moved chips. */
export function remainingInventory(chipSet: ChipSet, handedOut: ChipCount): ChipCount {
  const out: ChipCount = {};
  for (const color of chipSet.colors) {
    out[color.id] = color.quantity - (handedOut[color.id] ?? 0);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Denomination assignment
// ---------------------------------------------------------------------------

/** Picks `k` values out of `values`, evenly spaced, always keeping both ends. */
function subsample(values: number[], k: number): number[] {
  if (k >= values.length) return values.slice();
  if (k <= 1) return [values[0]!];
  const out: number[] = [];
  for (let i = 0; i < k; i++) {
    out.push(values[Math.round((i * (values.length - 1)) / (k - 1))]!);
  }
  return Array.from(new Set(out));
}

/**
 * Chooses the denomination ladder slice that suits a given starting stack.
 *
 * The bounds come from how a stack actually plays: the smallest chip wants to be
 * around 1/60th of a stack (so you can post blinds for a while without making
 * change), and the largest wants to be no more than a quarter of a stack (a chip
 * you only ever hold one of is a chip you can't bet).
 */
export function ladderSliceFor(stackUnits: number, colorCount: number, scale: ChipScale): number[] {
  const ladder = ladderFor(scale);
  if (colorCount <= 0 || stackUnits <= 0) return [];

  const lowTarget = stackUnits / 60;
  const highTarget = stackUnits / 4;

  let start = 0;
  for (let i = 0; i < ladder.length; i++) if (ladder[i]! <= lowTarget) start = i;
  let end = ladder.length - 1;
  for (let i = ladder.length - 1; i >= 0; i--) if (ladder[i]! >= highTarget) end = i;
  if (end < start) end = start;

  // Grow toward the requested colour count. Smaller chips earn their place before
  // bigger ones do, so extend downward first.
  while (end - start + 1 < colorCount) {
    if (start > 0) start--;
    else if (end < ladder.length - 1) end++;
    else break;
  }

  return subsample(ladder.slice(start, end + 1), colorCount);
}

export type AssignStrategy = 'quantity' | 'convention';

/**
 * Fills in values for blank chips.
 *
 * 'quantity' is the one that matters: the smallest denomination goes to whichever
 * colour the host owns the most of. Getting this backwards, and putting the $1
 * value on the stack of 20 chips, is how a chip set runs out mid-game.
 */
export function assignValues(
  chipSet: ChipSet,
  opts: {
    strategy: AssignStrategy;
    stackUnits: number;
    scale: ChipScale;
    /** Leave colours that already have a printed value alone. */
    onlyBlank?: boolean;
  },
): { colors: ChipColor[]; notices: Notice[] } {
  const notices: Notice[] = [];
  const withQuantity = chipSet.colors.filter((c) => c.quantity > 0);
  const locked = opts.onlyBlank ? withQuantity.filter((c) => c.value != null && c.value > 0) : [];
  const present = opts.onlyBlank
    ? withQuantity.filter((c) => c.value == null || c.value <= 0)
    : withQuantity;
  const absent = chipSet.colors.filter((c) => c.quantity <= 0);

  if (present.length === 0) {
    return {
      colors: chipSet.colors.map((c) => ({ ...c, value: null })),
      notices: [{ level: 'warn', message: 'Add chip quantities before assigning values.' }],
    };
  }

  const assigned = new Map<string, number | null>();

  if (opts.strategy === 'convention') {
    const multiplier = opts.scale.kind === 'dollar' ? 100 : 1;
    for (const color of present) {
      const key = color.label.trim().toLowerCase();
      const base = CONVENTION[key];
      assigned.set(color.id, base != null ? base * multiplier : null);
    }
    const unmatched = present.filter((c) => assigned.get(c.id) == null);
    if (unmatched.length) {
      notices.push({
        level: 'warn',
        message: `No standard value for ${unmatched
          .map((c) => c.label)
          .join(', ')}. Set ${unmatched.length === 1 ? 'it' : 'them'} by hand.`,
      });
    }
  } else {
    // Values already printed on chips are fixed points; the blanks fill in around them.
    const taken = new Set(locked.map((c) => c.value!));
    const slice = ladderSliceFor(
      opts.stackUnits,
      present.length + locked.length,
      opts.scale,
    ).filter((v) => !taken.has(v));
    // Most plentiful colour gets the smallest value.
    const byQuantity = present
      .slice()
      .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label));

    byQuantity.forEach((color, i) => assigned.set(color.id, slice[i] ?? null));

    const unused = byQuantity.filter((c) => assigned.get(c.id) == null);
    if (unused.length) {
      notices.push({
        level: 'info',
        message: `${unused
          .map((c) => c.label)
          .join(', ')} left out. This buy-in doesn't need that many denominations, so keep them for a bigger game.`,
      });
    }
  }

  const lockedIds = new Set(locked.map((c) => c.id));
  const colors = chipSet.colors.map((c) => {
    if (lockedIds.has(c.id)) return c;
    return assigned.has(c.id) ? { ...c, value: assigned.get(c.id)! } : { ...c, value: null };
  });

  if (absent.length) {
    notices.push({
      level: 'info',
      message: `${absent.map((c) => c.label).join(', ')} skipped, because the quantity is zero.`,
    });
  }

  return { colors, notices };
}

// ---------------------------------------------------------------------------
// Feasibility
// ---------------------------------------------------------------------------

export interface FeasibilityInput {
  chipSet: ChipSet;
  /** Total chip units that need to go out on the table. */
  requiredUnits: number;
  /** Every distinct stack size that has to be made exactly. */
  stackTargets: number[];
  smallBlind?: number;
  playerCount: number;
}

export function checkFeasibility(input: FeasibilityInput): Notice[] {
  const notices: Notice[] = [];
  const colors = activeColors(input.chipSet);

  if (colors.length === 0) {
    notices.push({ level: 'error', message: 'No chip colours have both a value and a quantity.' });
    return notices;
  }

  const available = inventoryUnits(input.chipSet);
  if (available < input.requiredUnits) {
    notices.push({
      level: 'error',
      message: `Your chips are worth less than the money on the table. You need more chips, or higher denominations.`,
    });
  }

  const denoms = colors.map((c) => c.value!);
  const step = gcdAll(denoms);
  const unmakeable = input.stackTargets.filter((t) => t % step !== 0);
  if (unmakeable.length) {
    notices.push({
      level: 'error',
      message: `Some buy-ins can't be made exactly from your chips. Every stack has to be a multiple of your smallest common value.`,
    });
  }

  if (colors.length === 1) {
    notices.push({
      level: 'warn',
      message: 'Only one denomination in play. Betting will be very coarse.',
    });
  }

  if (input.smallBlind != null && input.smallBlind > 0) {
    const smallest = denoms[0]!;
    if (input.smallBlind % smallest !== 0) {
      notices.push({
        level: 'error',
        message: `A ${input.smallBlind} small blind can't be posted with your chips.`,
      });
    }
  }

  const totalChips = colors.reduce((s, c) => s + c.quantity, 0);
  if (input.playerCount > 0 && totalChips / input.playerCount < 15) {
    notices.push({
      level: 'warn',
      message: `Only ~${Math.floor(totalChips / input.playerCount)} chips per player. Stacks will be hard to bet with.`,
    });
  }

  return notices;
}
