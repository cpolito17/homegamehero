import { useMemo, useState } from 'react';
import { colorUp, suggestColorUp } from '@/lib/colorup';
import { formatUnits, parseCount } from '@/lib/money';
import { currentBlinds } from '@/state/reducer';
import { useDispatch, useGameState } from '@/state/store';
import { ChipDot } from './Chips';
import { Card, Notices, NumberInput, SectionTitle, Toggle } from './Ui';

export function ColorUpPanel() {
  const state = useGameState();
  const dispatch = useDispatch();
  const blinds = currentBlinds(state);

  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [protectShort, setProtectShort] = useState(true);
  const [open, setOpen] = useState(false);

  const { smallBlind, bigBlind, ante } = blinds;
  const suggestion = useMemo(() => {
    const withoutRetired = {
      ...state.chipSet,
      colors: state.chipSet.colors.filter((c) => !state.retiredColorIds.includes(c.id)),
    };
    return suggestColorUp(withoutRetired, { smallBlind, bigBlind, ante });
  }, [state.chipSet, state.retiredColorIds, smallBlind, bigBlind, ante]);

  if (!suggestion) return null;

  const players = state.players.filter((p) => !p.leftAt && !state.eliminations.includes(p.id));
  const result = colorUp({
    retire: suggestion.retire,
    into: suggestion.into,
    holdings: Object.fromEntries(players.map((p) => [p.id, holdings[p.id] ?? 0])),
    protectShortStacks: protectShort,
  });

  const anyEntered = players.some((p) => (holdings[p.id] ?? 0) > 0);

  return (
    <Card className="!border-gold-500/25">
      <SectionTitle
        title="Time to colour up"
        hint={suggestion.reason}
        action={
          <button type="button" className="btn-ghost !py-2 !text-xs" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Race it off'}
          </button>
        }
      />

      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <ChipDot hex={suggestion.retire.hex} size={18} />
          <span className="text-ink-200">{suggestion.retire.label}</span>
          <span className="num text-xs text-ink-500">
            {formatUnits(suggestion.retire.value!, state.scale)}
          </span>
        </span>
        <span className="text-ink-600">→</span>
        <span className="flex items-center gap-1.5">
          <ChipDot hex={suggestion.into.hex} size={18} />
          <span className="text-ink-200">{suggestion.into.label}</span>
          <span className="num text-xs text-ink-500">
            {formatUnits(suggestion.into.value!, state.scale)}
          </span>
        </span>
      </div>

      {open && (
        <div className="mt-4 animate-slide-up border-t border-white/5 pt-4">
          <span className="label">
            {suggestion.retire.label} chips in front of each player
          </span>

          <div className="space-y-2">
            {players.map((player) => {
              const line = result.lines.find((l) => l.playerId === player.id);
              return (
                <div key={player.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-300">{player.name}</span>
                  <NumberInput
                    value={holdings[player.id] ?? 0}
                    onCommit={(count) =>
                      setHoldings((h) => ({ ...h, [player.id]: Math.max(0, count) }))
                    }
                    parse={(raw) => (raw.trim() === '' ? 0 : parseCount(raw))}
                    format={(v) => (v ? String(v) : '')}
                    inputMode="numeric"
                    placeholder="0"
                    className="num w-16 shrink-0 !px-2 !py-2 text-right !text-base"
                    ariaLabel={`${player.name} chips to race`}
                  />
                  <span className="num w-24 shrink-0 text-right text-sm font-semibold text-felt-300">
                    {line && line.awarded > 0
                      ? `+${line.awarded} ${suggestion.into.label.toLowerCase()}`
                      : '—'}
                    {line?.rescued && <span className="ml-1 text-[10px] text-gold-400">kept</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t border-white/5 pt-3">
            <Toggle
              checked={protectShort}
              onChange={setProtectShort}
              label="Nobody gets raced out"
              hint="A player with chips keeps at least one, even if their odd amount loses the race."
            />
          </div>

          {anyEntered && (
            <>
              <Notices notices={result.notices} className="mt-3" />
              {result.valueChangeUnits !== 0 && (
                <p className="mt-2 text-xs text-ink-500">
                  {result.valueChangeUnits < 0
                    ? `${formatUnits(-result.valueChangeUnits, state.scale)} of odd value leaves play — normal for a race, and less than one chip per player.`
                    : `${formatUnits(result.valueChangeUnits, state.scale)} added to keep short stacks alive.`}
                </p>
              )}
            </>
          )}

          <button
            type="button"
            className="btn-primary mt-4 w-full"
            onClick={() => {
              dispatch({ type: 'retireColor', colorId: suggestion.retire.id });
              setHoldings({});
              setOpen(false);
            }}
          >
            Take {suggestion.retire.label.toLowerCase()} off the table
          </button>
        </div>
      )}
    </Card>
  );
}
