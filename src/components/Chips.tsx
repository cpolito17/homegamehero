import { activeColors, countChips, countUnits } from '@/lib/chips';
import { formatUnits, type ChipScale } from '@/lib/money';
import type { ChipCount, ChipSet } from '@/lib/types';

/** Picks black or white text for a swatch so labels stay readable on any colour. */
export function readableOn(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Rec. 709 luma
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.6 ? '#12161d' : '#ffffff';
}

export function ChipDot({ hex, size = 20 }: { hex: string; size?: number }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full shadow-chip"
      style={{ background: hex, width: size, height: size }}
      aria-hidden
    />
  );
}

/** One colour with a count, e.g. a red disc reading "×6". */
export function ChipPill({
  hex,
  label,
  count,
}: {
  hex: string;
  label: string;
  count: number;
}) {
  return (
    <span
      className="chip-pill"
      style={{ background: hex, color: readableOn(hex) }}
      title={`${count} × ${label}`}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-bold">×{count}</span>
    </span>
  );
}

/** Renders a whole stack as coloured pills plus its total value. */
export function ChipStackView({
  counts,
  chipSet,
  scale,
  showTotal = true,
  emptyLabel = 'No chips',
}: {
  counts: ChipCount;
  chipSet: ChipSet;
  scale: ChipScale;
  showTotal?: boolean;
  emptyLabel?: string;
}) {
  const colors = activeColors(chipSet).filter((c) => (counts[c.id] ?? 0) > 0);
  if (colors.length === 0) {
    return <span className="text-xs text-ink-500">{emptyLabel}</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {colors.map((color) => (
        <ChipPill
          key={color.id}
          hex={color.hex}
          label={color.label}
          count={counts[color.id] ?? 0}
        />
      ))}
      {showTotal && (
        <span className="num ml-1 text-sm font-semibold text-ink-200">
          {formatUnits(countUnits(counts, chipSet), scale)}
          <span className="ml-1 text-xs font-normal text-ink-500">
            · {countChips(counts)} chips
          </span>
        </span>
      )}
    </div>
  );
}
