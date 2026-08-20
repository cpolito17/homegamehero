import { useEffect, useMemo, useState } from 'react';
import { scheduleDurationMinutes } from '@/lib/blinds';
import { formatMoney, formatUnits, parseCount, parseMoney, parseUnits } from '@/lib/money';
import { generateLevels } from '@/state/reducer';
import { useDispatch, useGameState } from '@/state/store';
import { Card, Field, NumberInput, SectionTitle, Stat, Toggle } from './Ui';
import { LevelSchedule } from './LevelSchedule';
import { PrizeSplitEditor } from './PrizeSplitEditor';

export function TournamentPanel() {
  const state = useGameState();
  const dispatch = useDispatch();
  const t = state.tournament;
  const [showSchedule, setShowSchedule] = useState(false);

  // Same generator the reducer uses, so the preview can't drift from the real thing.
  const generated = useMemo(() => generateLevels(state), [state]);

  // Keep the schedule in sync until the host generates one deliberately.
  useEffect(() => {
    if (!t.levelsAuto) return;
    if (JSON.stringify(generated) === JSON.stringify(t.levels)) return;
    dispatch({ type: 'patchTournament', patch: { levels: generated } });
  }, [generated, t.levelsAuto, t.levels, dispatch]);

  // Entries only at this point. Rebuys and add-ons join the pool as they happen.
  const prizePool = t.buyInCents * state.players.length;
  const startDepth = t.levels[0]?.bigBlind
    ? Math.round(t.startingStackUnits / t.levels[0].bigBlind)
    : 0;

  return (
    <>
      <Card>
        <SectionTitle title="Tournament" hint="Entry, stacks, and how fast the blinds climb." />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Buy-in">
            <NumberInput
              value={t.buyInCents}
              onCommit={(buyInCents) => dispatch({ type: 'patchTournament', patch: { buyInCents } })}
              parse={parseMoney}
              format={(v) => formatMoney(v)}
            />
          </Field>
          <Field
            label="Starting stack"
            hint={state.scale.kind === 'points' ? 'In chip points' : 'In chip value'}
          >
            <NumberInput
              value={t.startingStackUnits}
              onCommit={(startingStackUnits) =>
                dispatch({ type: 'patchTournament', patch: { startingStackUnits } })
              }
              parse={(raw) => parseUnits(raw, state.scale)}
              format={(v) => formatUnits(v, state.scale)}
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Level length">
            <NumberInput
              value={t.levelMinutes}
              onCommit={(levelMinutes) =>
                dispatch({ type: 'patchTournament', patch: { levelMinutes, levelsAuto: true } })
              }
              parse={parseCount}
              format={(v) => `${v} min`}
              inputMode="numeric"
            />
          </Field>
          <Field label="Target length">
            <NumberInput
              value={t.targetDurationMinutes}
              onCommit={(targetDurationMinutes) =>
                dispatch({
                  type: 'patchTournament',
                  patch: { targetDurationMinutes, levelsAuto: true },
                })
              }
              parse={parseCount}
              format={(v) => `${Math.round((v / 60) * 10) / 10} hrs`}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Break every" hint={`${t.breakMinutes} min break`}>
            <NumberInput
              value={t.breakEveryLevels}
              onCommit={(breakEveryLevels) =>
                dispatch({ type: 'patchTournament', patch: { breakEveryLevels, levelsAuto: true } })
              }
              parse={parseCount}
              format={(v) => (v > 0 ? `${v} levels` : 'never')}
              inputMode="numeric"
            />
          </Field>
          <Field label="Antes start" hint="Big blind ante">
            <NumberInput
              value={t.anteStartLevel ?? 0}
              onCommit={(value) =>
                dispatch({
                  type: 'patchTournament',
                  patch: { anteStartLevel: value > 0 ? value : null, levelsAuto: true },
                })
              }
              parse={parseCount}
              format={(v) => (v > 0 ? `level ${v}` : 'never')}
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Levels" mono value={t.levels.filter((l) => !l.isBreak).length} />
          <Stat
            label="Runs about" mono
            value={`${Math.round((scheduleDurationMinutes(t.levels) / 60) * 10) / 10}h`}
          />
          <Stat label="Starts at" mono value={`${startDepth} bb`} tone={startDepth < 30 ? 'bad' : 'good'} />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost !py-2 !text-xs"
            onClick={() => setShowSchedule((v) => !v)}
          >
            {showSchedule ? 'Hide' : 'Show'} schedule
          </button>
          {!t.levelsAuto && (
            <button
              type="button"
              className="btn-ghost !py-2 !text-xs"
              onClick={() =>
                dispatch({ type: 'patchTournament', patch: { levelsAuto: true, levels: generated } })
              }
            >
              Regenerate
            </button>
          )}
        </div>

        {showSchedule && (
          <div className="mt-3 border-t border-white/5 pt-3">
            <LevelSchedule levels={t.levels} scale={state.scale} />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Rebuys & add-ons" hint="Set the cutoff to zero for a freezeout." />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rebuys through">
            <NumberInput
              value={t.rebuyThroughLevel}
              onCommit={(rebuyThroughLevel) =>
                dispatch({ type: 'patchTournament', patch: { rebuyThroughLevel } })
              }
              parse={parseCount}
              format={(v) => (v > 0 ? `level ${v}` : 'freezeout')}
              inputMode="numeric"
            />
          </Field>
          <Field label="Rebuy costs">
            <NumberInput
              value={t.rebuyCents}
              onCommit={(rebuyCents) => dispatch({ type: 'patchTournament', patch: { rebuyCents } })}
              parse={parseMoney}
              format={(v) => formatMoney(v)}
              disabled={t.rebuyThroughLevel === 0}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Toggle
            checked={t.addOnEnabled}
            onChange={(addOnEnabled) => dispatch({ type: 'patchTournament', patch: { addOnEnabled } })}
            label="Add-on at the break"
            hint="One-time top-up, usually a bigger stack than a rebuy."
          />
        </div>

        {t.addOnEnabled && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Add-on costs">
              <NumberInput
                value={t.addOnCents}
                onCommit={(addOnCents) => dispatch({ type: 'patchTournament', patch: { addOnCents } })}
                parse={parseMoney}
                format={(v) => formatMoney(v)}
              />
            </Field>
            <Field label="Add-on stack">
              <NumberInput
                value={t.addOnStackUnits}
                onCommit={(addOnStackUnits) =>
                  dispatch({ type: 'patchTournament', patch: { addOnStackUnits } })
                }
                parse={(raw) => parseUnits(raw, state.scale)}
                format={(v) => formatUnits(v, state.scale)}
              />
            </Field>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Prizes"
          hint="Yours to set. The pool grows with every rebuy."
        />
        <PrizeSplitEditor
          split={t.prizeSplit}
          poolCents={prizePool}
          onChange={(split) => dispatch({ type: 'setPrizeSplit', split })}
        />
      </Card>
    </>
  );
}
