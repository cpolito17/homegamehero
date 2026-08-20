import { useMemo } from 'react';
import { checkFeasibility, countChips, countUnits } from '@/lib/chips';
import { formatMoney, formatUnits } from '@/lib/money';
import type { DistributionMode } from '@/lib/types';
import { currentBlinds, stackUnitsFor } from '@/state/reducer';
import { useDispatch, useGameState } from '@/state/store';
import { ChipStackView } from './Chips';
import { Card, Notices, SectionTitle, Segmented, Stat, Stepper } from './Ui';

const MODES: { value: DistributionMode; label: string; blurb: string }[] = [
  {
    value: 'balanced',
    label: 'Balanced',
    blurb:
      'Enough small chips to post blinds for a while, then a ramp upward. The default for a reason.',
  },
  {
    value: 'efficient',
    label: 'Efficient',
    blurb:
      'The fewest chips that still play properly. Keeps the box full for rebuys and a bigger table.',
  },
  {
    value: 'deep',
    label: 'Deep stack',
    blurb: 'As many chips as the box allows. Looks great, drains your inventory fastest.',
  },
];

export function DistributionPanel() {
  const state = useGameState();
  const dispatch = useDispatch();
  const blinds = currentBlinds(state);

  const targets = state.players.map((p) => stackUnitsFor(state, p.buyInCents));
  const targetKey = targets.join(',');
  const smallBlind = blinds.smallBlind;
  const playerCount = state.players.length;
  const chipSet = state.chipSet;

  const feasibility = useMemo(
    () => {
      const stackTargets = targetKey ? targetKey.split(',').map(Number) : [];
      return checkFeasibility({
        chipSet,
        requiredUnits: stackTargets.reduce((a, b) => a + b, 0),
        stackTargets,
        smallBlind,
        playerCount,
      });
    },
    [chipSet, targetKey, smallBlind, playerCount],
  );

  const result = state.distribution;
  const activeMode = MODES.find((m) => m.value === state.distributionMode)!;
  const blocked = feasibility.some((n) => n.level === 'error') || state.players.length === 0;

  return (
    <Card>
      <SectionTitle
        title="Chip distribution"
        hint="Stacks worth exactly the buy-in, built from the chips you actually own."
      />

      <span className="label">Stack profile</span>
      <Segmented
        value={state.distributionMode}
        options={MODES.map((m) => ({ value: m.value, label: m.label }))}
        onChange={(mode) => dispatch({ type: 'setDistributionMode', mode })}
      />
      <p className="mt-2 text-xs leading-snug text-ink-500">{activeMode.blurb}</p>

      <div className="mt-4 flex items-center justify-between gap-4 border-t border-line/5 pt-3">
        <div className="min-w-0">
          <span className="block text-sm font-medium text-ink-100">Hold back for rebuys</span>
          <span className="mt-0.5 block text-xs leading-snug text-ink-400">
            Full stacks kept in the box. Deal out everything and the first rebuy has nothing to pay
            with.
          </span>
        </div>
        <Stepper
          value={state.reserveStacks}
          onChange={(count) => dispatch({ type: 'setReserveStacks', count })}
          max={20}
          label="reserve stacks"
        />
      </div>

      <Notices notices={feasibility} className="mt-4" />

      <button
        type="button"
        className="btn-primary mt-4 w-full !py-3 text-base"
        disabled={blocked}
        onClick={() => dispatch({ type: 'runDistribution' })}
      >
        {result ? 'Recalculate stacks' : 'Calculate stacks'}
      </button>

      {result && (
        <div className="mt-5">
          <Notices notices={result.notices} className="mb-4" />

          <div className="space-y-2">
            {result.stacks.map((stack) => {
              const player = state.players.find((p) => p.id === stack.playerId);
              return (
                <div
                  key={stack.playerId}
                  className="rounded-control border border-line/5 bg-raise/[.02] p-3"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-ink-100">
                      {player?.name ?? 'Player'}
                    </span>
                    <span className="num shrink-0 text-sm text-ink-400">
                      {formatMoney(player?.buyInCents ?? 0)}
                      {!stack.exact && (
                        <span className="ml-2 text-red-300">
                          short {formatUnits(stack.targetUnits - stack.totalUnits, state.scale)}
                        </span>
                      )}
                    </span>
                  </div>
                  <ChipStackView
                    counts={stack.counts}
                    chipSet={state.chipSet}
                    scale={state.scale}
                    summary="count"
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat
              label="Reserve"
              value={`${result.reserveStacks} ${result.reserveStacks === 1 ? 'stack' : 'stacks'}`}
              sub={`${countChips(result.reserve)} chips · ${formatUnits(countUnits(result.reserve, state.chipSet), state.scale)}`}
              tone={result.reserveStacks < state.reserveStacks ? 'bad' : 'good'}
            />
            <Stat
              label="Still in the box"
              value={`${countChips(result.leftover)} chips`}
              sub={formatUnits(countUnits(result.leftover, state.chipSet), state.scale)}
            />
          </div>

          {countChips(result.reserve) > 0 && (
            <div className="mt-3 rounded-control border border-line/5 bg-raise/[.02] p-3">
              <span className="label">Set aside for rebuys</span>
              <ChipStackView counts={result.reserve} chipSet={state.chipSet} scale={state.scale} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
