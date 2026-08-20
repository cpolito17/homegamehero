import { useEffect, useMemo } from 'react';
import { blindStep, recommendCashBlinds, smallBlindFor } from '@/lib/blinds';
import { denominations } from '@/lib/chips';
import { formatUnits, parseUnits, roundToIncrement } from '@/lib/money';
import { stackUnitsFor } from '@/state/reducer';
import { useDispatch, useGameState } from '@/state/store';
import { Card, Field, NumberInput, Notices, SectionTitle, Segmented, Stat } from './Ui';

const DEPTH_PRESETS = [
  { value: '100', label: 'Deep', hint: '100 bb' },
  { value: '50', label: 'Standard', hint: '50 bb' },
  { value: '30', label: 'Action', hint: '30 bb' },
] as const;

export function BlindsPanel() {
  const state = useGameState();
  const dispatch = useDispatch();

  const denoms = useMemo(() => denominations(state.chipSet), [state.chipSet]);
  const step = blindStep(denoms);
  const stackUnits = stackUnitsFor(state, state.cash.universalBuyInCents);

  const suggestion = useMemo(
    () =>
      recommendCashBlinds({
        stackUnits,
        denominations: denoms,
        depthTargetBB: state.cash.depthTargetBB,
      }),
    [stackUnits, denoms, state.cash.depthTargetBB],
  );

  // Track the recommendation until the host takes the wheel.
  useEffect(() => {
    if (!state.cash.blindsAuto) return;
    if (
      suggestion.bigBlind === state.cash.bigBlind &&
      suggestion.smallBlind === state.cash.smallBlind
    )
      return;
    dispatch({
      type: 'patchCash',
      patch: { smallBlind: suggestion.smallBlind, bigBlind: suggestion.bigBlind },
    });
  }, [suggestion, state.cash.blindsAuto, state.cash.bigBlind, state.cash.smallBlind, dispatch]);

  const depth = state.cash.bigBlind > 0 ? stackUnits / state.cash.bigBlind : 0;
  const notices = state.cash.blindsAuto ? suggestion.notices : [];

  const setBlind = (which: 'smallBlind' | 'bigBlind', raw: number) => {
    // Blinds have to be payable, so every edit lands on a chip increment.
    const snapped = Math.max(step, roundToIncrement(raw, step));
    const patch =
      which === 'bigBlind'
        ? { bigBlind: snapped, smallBlind: smallBlindFor(snapped, step), blindsAuto: false }
        : { smallBlind: Math.min(snapped, state.cash.bigBlind), blindsAuto: false };
    dispatch({ type: 'patchCash', patch });
  };

  return (
    <Card>
      <SectionTitle
        title="Blinds"
        hint="Set by how deep the stacks are, not by the size of the pot — a 50 big blind stack plays the same with three people or nine."
        action={
          !state.cash.blindsAuto && (
            <button
              type="button"
              className="btn-ghost !py-2 !text-xs"
              onClick={() =>
                dispatch({
                  type: 'patchCash',
                  patch: {
                    blindsAuto: true,
                    smallBlind: suggestion.smallBlind,
                    bigBlind: suggestion.bigBlind,
                  },
                })
              }
            >
              Reset
            </button>
          )
        }
      />

      <span className="label">Starting depth</span>
      <Segmented
        value={String(state.cash.depthTargetBB) as '100' | '50' | '30'}
        options={DEPTH_PRESETS.map((p) => ({ value: p.value, label: `${p.label} · ${p.hint}` }))}
        onChange={(value) =>
          dispatch({
            type: 'patchCash',
            patch: { depthTargetBB: Number(value), blindsAuto: true },
          })
        }
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Small blind">
          <NumberInput
            value={state.cash.smallBlind}
            onCommit={(v) => setBlind('smallBlind', v)}
            parse={(raw) => parseUnits(raw, state.scale)}
            format={(v) => formatUnits(v, state.scale)}
            className="num text-lg"
          />
        </Field>
        <Field label="Big blind">
          <NumberInput
            value={state.cash.bigBlind}
            onCommit={(v) => setBlind('bigBlind', v)}
            parse={(raw) => parseUnits(raw, state.scale)}
            format={(v) => formatUnits(v, state.scale)}
            className="num text-lg"
          />
        </Field>
      </div>

      <p className="mt-2 text-xs text-ink-500">
        Edits snap to {formatUnits(step, state.scale)} — the smallest chip you can actually put in
        the middle.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat
          label="Starting depth"
          value={`${depth > 0 ? Math.round(depth) : 0} bb`}
          tone={depth < 25 ? 'bad' : depth > 150 ? 'gold' : 'good'}
        />
        <Stat
          label="An orbit costs"
          value={formatUnits(state.cash.smallBlind + state.cash.bigBlind, state.scale)}
        />
      </div>

      <Notices notices={notices} className="mt-3" />
    </Card>
  );
}
