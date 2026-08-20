import { formatUnits, type ChipScale } from '@/lib/money';
import type { BlindLevel } from '@/lib/types';

export function LevelSchedule({
  levels,
  scale,
  currentIndex,
  onPick,
  max,
}: {
  levels: BlindLevel[];
  scale: ChipScale;
  currentIndex?: number;
  onPick?: (index: number) => void;
  max?: number;
}) {
  if (levels.length === 0) {
    return <p className="text-sm text-ink-500">No schedule generated yet.</p>;
  }

  const shown = max ? levels.slice(0, max) : levels;
  let playNumber = 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-sm">
        <thead>
          <tr className="text-xs font-medium text-ink-500">
            <th className="py-1.5 pr-2 text-left font-medium">Level</th>
            <th className="py-1.5 pr-2 text-right font-medium">Blinds</th>
            <th className="py-1.5 pr-2 text-right font-medium">Ante</th>
            <th className="py-1.5 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((level, index) => {
            if (!level.isBreak) playNumber++;
            const isCurrent = currentIndex === index;
            return (
              <tr
                key={level.index}
                onClick={onPick ? () => onPick(index) : undefined}
                className={[
                  'border-t border-line/5',
                  onPick ? 'cursor-pointer hover:bg-raise/5' : '',
                  isCurrent ? 'bg-accent-600/20' : '',
                  level.isBreak ? 'text-money-400' : 'text-ink-200',
                ].join(' ')}
              >
                <td className="py-1.5 pr-2 font-medium">
                  {level.isBreak ? 'Break' : playNumber}
                  {isCurrent && <span className="ml-1.5 text-[10px] text-accent-300">NOW</span>}
                </td>
                <td className="num py-1.5 pr-2 text-right">
                  {level.isBreak
                    ? ''
                    : `${formatUnits(level.smallBlind, scale)} / ${formatUnits(level.bigBlind, scale)}`}
                </td>
                <td className="num py-1.5 pr-2 text-right text-ink-400">
                  {level.ante > 0 ? formatUnits(level.ante, scale) : ''}
                </td>
                <td className="num py-1.5 text-right text-ink-400">{level.minutes}m</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {max && levels.length > max && (
        <p className="mt-2 text-xs text-ink-500">+{levels.length - max} more levels</p>
      )}
    </div>
  );
}
