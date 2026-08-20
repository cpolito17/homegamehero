import { prizeSplitNotices } from '@/lib/payout';
import { formatMoney } from '@/lib/money';
import { allocateProportional } from '@/lib/money';
import type { PrizeSlot } from '@/lib/types';
import { Minus, Plus } from '@phosphor-icons/react';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Notices } from './Ui';

export function PrizeSplitEditor({
  split,
  poolCents,
  onChange,
}: {
  split: PrizeSlot[];
  poolCents: number;
  onChange: (split: PrizeSlot[]) => void;
}) {
  const ordered = split.slice().sort((a, b) => a.place - b.place);
  const total = ordered.reduce((s, p) => s + p.percent, 0);
  const rounded = Math.round(total * 100) / 100;
  const amounts = allocateProportional(
    Math.max(0, poolCents),
    ordered.map((s) => Math.max(0, s.percent)),
  );

  const setPercent = (place: number, percent: number) => {
    onChange(ordered.map((slot) => (slot.place === place ? { ...slot, percent } : slot)));
  };

  const addPlace = () => {
    onChange([...ordered, { place: ordered.length + 1, percent: 0 }]);
  };

  const removePlace = () => {
    if (ordered.length <= 1) return;
    onChange(ordered.slice(0, -1));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label !mb-0">Payout split</span>
        <span
          className={`num text-sm font-semibold ${
            rounded === 100 ? 'text-felt-300' : 'text-red-300'
          }`}
        >
          {rounded}%
        </span>
      </div>

      <div className="space-y-2">
        {ordered.map((slot, i) => (
          <div key={slot.place} className="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-2">
            <span className="text-sm font-medium text-ink-300">
              {slot.place}
              {ordinalSuffix(slot.place)}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={slot.percent}
                onChange={(e) => setPercent(slot.place, Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-800 accent-felt-400"
                aria-label={`Place ${slot.place} percentage`}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={slot.percent}
                onChange={(e) => setPercent(slot.place, Math.max(0, Number(e.target.value) || 0))}
                className="field num w-16 !px-2 !py-1.5 text-right !text-sm"
                aria-label={`Place ${slot.place} percentage value`}
              />
            </div>
            <span className="num text-right text-sm font-semibold text-gold-400">
              {formatMoney(amounts[i] ?? 0)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <Pressable depth="sm" feedback="select" className="btn-ghost !py-1.5 !text-xs" onClick={addPlace}>
          <Icon as={Plus} size={13} />
          Place
        </Pressable>
        <Pressable
          depth="sm"
          feedback="select"
          className="btn-ghost !py-1.5 !text-xs"
          onClick={removePlace}
          disabled={ordered.length <= 1}
        >
          <Icon as={Minus} size={13} />
          Place
        </Pressable>
      </div>

      <Notices notices={prizeSplitNotices(ordered)} className="mt-3" />
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export { ordinalSuffix };
