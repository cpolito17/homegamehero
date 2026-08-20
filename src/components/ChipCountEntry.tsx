import { activeColors, countChips } from '@/lib/chips';
import { formatUnits, parseCount, type ChipScale } from '@/lib/money';
import type { ChipCount, ChipSet } from '@/lib/types';
import { ChipDot } from './Chips';
import { NumberInput } from './Ui';

/**
 * Per-colour chip entry.
 *
 * Laid out as one big tappable row per colour because this gets used at the end
 * of the night, on a phone, by someone counting chips with their other hand.
 */
export function ChipCountEntry({
  chipSet,
  scale,
  counts,
  onChange,
  excludeColorIds = [],
  compact = false,
}: {
  chipSet: ChipSet;
  scale: ChipScale;
  counts: ChipCount;
  onChange: (colorId: string, count: number) => void;
  excludeColorIds?: string[];
  compact?: boolean;
}) {
  const colors = activeColors(chipSet).filter((c) => !excludeColorIds.includes(c.id));
  const total = colors.reduce((sum, c) => sum + (counts[c.id] ?? 0) * c.value!, 0);

  return (
    <div>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
        {colors.map((color) => (
          <div key={color.id} className="flex items-center gap-2">
            <ChipDot hex={color.hex} size={compact ? 18 : 22} />
            <span className="min-w-0 flex-1 truncate text-sm text-ink-300">
              {color.label}
              <span className="num ml-1.5 text-xs text-ink-500">
                {formatUnits(color.value!, scale)}
              </span>
            </span>
            <NumberInput
              value={counts[color.id] ?? 0}
              onCommit={(count) => onChange(color.id, Math.max(0, count))}
              parse={(raw) => (raw.trim() === '' ? 0 : parseCount(raw))}
              format={(v) => (v ? String(v) : '')}
              inputMode="numeric"
              placeholder="0"
              className="num w-16 shrink-0 !px-2 !py-2 text-right !text-base"
              ariaLabel={`${color.label} count`}
            />
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between border-t border-white/5 pt-2.5">
        <span className="text-xs text-ink-500">{countChips(counts)} chips</span>
        <span className="num text-lg font-semibold text-gold-400">{formatUnits(total, scale)}</span>
      </div>
    </div>
  );
}
