import type { ChipColor, ChipSet, Notice } from './types';
import { activeColors } from './chips';
import { allocateProportional } from './money';

export interface ColorUpSuggestion {
  retire: ChipColor;
  into: ChipColor;
  reason: string;
}

/**
 * Finds a denomination that no longer does any work.
 *
 * Once every blind and ante is a clean multiple of the next chip up, the smaller
 * chip can only slow the game down — it clutters stacks and nobody can bet it.
 * That is the moment to race it off.
 */
export function suggestColorUp(
  chipSet: ChipSet,
  blinds: { smallBlind: number; bigBlind: number; ante: number },
): ColorUpSuggestion | null {
  const colors = activeColors(chipSet);
  if (colors.length < 2) return null;

  const smallest = colors[0]!;
  const next = colors[1]!;
  const amounts = [blinds.smallBlind, blinds.bigBlind, blinds.ante].filter((v) => v > 0);
  if (amounts.length === 0) return null;

  const redundant = amounts.every((v) => v % next.value! === 0);
  if (!redundant) return null;

  return {
    retire: smallest,
    into: next,
    reason: `Every blind is now a multiple of the ${next.label.toLowerCase()} chip, so the ${smallest.label.toLowerCase()} chips can come off the table.`,
  };
}

export interface ColorUpLine {
  playerId: string;
  /** Chips of the retiring colour in front of this player. */
  retiredChips: number;
  retiredValue: number;
  /** Chips of the replacement colour they receive. */
  awarded: number;
  /** Value that didn't divide evenly and went into the race. */
  remainder: number;
  /** True when a short stack was kept alive rather than raced out. */
  rescued: boolean;
}

export interface ColorUpResult {
  retiredColorId: string;
  intoColorId: string;
  lines: ColorUpLine[];
  totalRetiredValue: number;
  totalAwardedValue: number;
  /** Awarded minus retired. Negative means value left the table, which is normal. */
  valueChangeUnits: number;
  notices: Notice[];
}

/**
 * Races off a denomination.
 *
 * Everyone gets the whole chips their stack converts to. The odd value left over
 * is pooled and awarded to the biggest remainders — the deterministic equivalent
 * of dealing cards for the odd chips, and it settles the argument about who eats
 * the rounding before it starts.
 */
export function colorUp(opts: {
  retire: ChipColor;
  into: ChipColor;
  /** playerId -> how many of the retiring colour they hold. */
  holdings: Record<string, number>;
  /** Keep players with chips from being raced out entirely. */
  protectShortStacks: boolean;
}): ColorUpResult {
  const notices: Notice[] = [];
  const retireValue = opts.retire.value ?? 0;
  const intoValue = opts.into.value ?? 0;

  const entries = Object.entries(opts.holdings).map(([playerId, chips]) => ({
    playerId,
    chips: Math.max(0, Math.floor(chips)),
  }));

  if (retireValue <= 0 || intoValue <= 0 || intoValue <= retireValue) {
    return {
      retiredColorId: opts.retire.id,
      intoColorId: opts.into.id,
      lines: entries.map((e) => ({
        playerId: e.playerId,
        retiredChips: e.chips,
        retiredValue: e.chips * retireValue,
        awarded: 0,
        remainder: 0,
        rescued: false,
      })),
      totalRetiredValue: 0,
      totalAwardedValue: 0,
      valueChangeUnits: 0,
      notices: [
        { level: 'error', message: 'Colour-up needs a larger denomination to convert into.' },
      ],
    };
  }

  const base = entries.map((e) => {
    const value = e.chips * retireValue;
    return { ...e, value, whole: Math.floor(value / intoValue), remainder: value % intoValue };
  });

  const totalRetiredValue = base.reduce((s, e) => s + e.value, 0);
  const wholeTotal = base.reduce((s, e) => s + e.whole, 0);
  // Whatever the whole conversions left behind, expressed in replacement chips.
  const racePool = Math.floor((totalRetiredValue - wholeTotal * intoValue) / intoValue);

  const extras = allocateProportional(
    racePool,
    base.map((e) => e.remainder),
  );

  const awarded = base.map((e, i) => e.whole + (extras[i] ?? 0));

  let rescuedCount = 0;
  const rescued = base.map((e, i) => {
    if (opts.protectShortStacks && e.value > 0 && awarded[i] === 0) {
      awarded[i] = 1;
      rescuedCount++;
      return true;
    }
    return false;
  });

  const totalAwardedValue = awarded.reduce((s, n) => s + n * intoValue, 0);
  const valueChangeUnits = totalAwardedValue - totalRetiredValue;

  if (rescuedCount > 0) {
    notices.push({
      level: 'info',
      message: `${rescuedCount} short ${rescuedCount === 1 ? 'stack was' : 'stacks were'} kept alive with one chip rather than being raced out.`,
    });
  }
  if (racePool > 0) {
    notices.push({
      level: 'info',
      message: `${racePool} ${opts.into.label.toLowerCase()} ${racePool === 1 ? 'chip goes' : 'chips go'} to the biggest odd amounts. Deal cards for them instead if the table prefers.`,
    });
  }

  return {
    retiredColorId: opts.retire.id,
    intoColorId: opts.into.id,
    lines: base.map((e, i) => ({
      playerId: e.playerId,
      retiredChips: e.chips,
      retiredValue: e.value,
      awarded: awarded[i] ?? 0,
      remainder: e.remainder,
      rescued: rescued[i] ?? false,
    })),
    totalRetiredValue,
    totalAwardedValue,
    valueChangeUnits,
    notices,
  };
}
