import { useState } from 'react';
import { countUnits } from '@/lib/chips';
import { formatUnits, unitsToCents, formatMoney } from '@/lib/money';
import type { ChipCount } from '@/lib/types';
import { useDispatch, useGameState } from '@/state/store';
import { ChipCountEntry } from './ChipCountEntry';
import { Card, ConfirmButton, SectionTitle } from './Ui';

/**
 * Records what everyone has in front of them right now.
 *
 * The ledger knows what came out of the box, but chips move across the table all
 * night, so it cannot say who is up at the break. Counting the stacks is the only
 * way to know, and having it written down is what settles the argument later.
 */
export function SnapshotPanel() {
  const state = useGameState();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, ChipCount>>({});
  const [label, setLabel] = useState('');

  const players = state.players.filter((p) => !p.leftAt);
  const snapshots = state.snapshots.slice().reverse();

  const countedUnits = players.reduce(
    (sum, p) => sum + countUnits(counts[p.id] ?? {}, state.chipSet),
    0,
  );

  function start() {
    setCounts({});
    setLabel(defaultLabel(state.snapshots.length));
    setOpen(true);
  }

  function save() {
    // Record everyone at the table, not just the stacks that got typed into.
    // A player left out of the map would vanish from the record entirely, which
    // is the one thing a snapshot exists to prevent.
    const full: Record<string, ChipCount> = {};
    for (const player of players) full[player.id] = counts[player.id] ?? {};
    dispatch({
      type: 'addSnapshot',
      label: label.trim() || defaultLabel(state.snapshots.length),
      counts: full,
    });
    setOpen(false);
  }

  return (
    <Card>
      <SectionTitle
        title="Snapshots"
        hint="Count the stacks at a break so there is a record of where everyone stood."
        action={
          !open && (
            <button type="button" className="btn-ghost !py-2 !text-xs" onClick={start}>
              + Add snapshot
            </button>
          )
        }
      />

      {open && (
        <div className="animate-slide-up space-y-3">
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What is this?"
            aria-label="Snapshot label"
            autoFocus
          />

          {players.length === 0 ? (
            <p className="text-sm text-ink-500">Nobody is at the table.</p>
          ) : (
            <div className="space-y-2">
              {players.map((player) => {
                const playerCounts = counts[player.id] ?? {};
                const units = countUnits(playerCounts, state.chipSet);
                return (
                  <details
                    key={player.id}
                    className="group rounded-control border border-line/5 bg-raise/[.02] px-3 py-2"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm marker:content-['']">
                      <span className="min-w-0 truncate font-medium text-ink-100">
                        {player.name}
                      </span>
                      <span className="num shrink-0 text-xs text-ink-400">
                        {formatUnits(units, state.scale)}
                      </span>
                    </summary>
                    <div className="mt-2 border-t border-line/5 pt-2">
                      <ChipCountEntry
                        chipSet={state.chipSet}
                        scale={state.scale}
                        counts={playerCounts}
                        excludeColorIds={state.retiredColorIds}
                        onChange={(colorId, count) =>
                          setCounts((prev) => ({
                            ...prev,
                            [player.id]: { ...(prev[player.id] ?? {}), [colorId]: count },
                          }))
                        }
                      />
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" className="btn-primary !py-2 !text-xs" onClick={save}>
              Save snapshot
            </button>
            <button
              type="button"
              className="btn-ghost !py-2 !text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <span className="num ml-auto shrink-0 whitespace-nowrap text-xs text-ink-500">
              {formatUnits(countedUnits, state.scale)}
            </span>
          </div>
        </div>
      )}

      {!open && snapshots.length === 0 && (
        <p className="text-sm text-ink-500">Nothing recorded yet.</p>
      )}

      {!open && snapshots.length > 0 && (
        <ul className="space-y-2">
          {snapshots.map((snap) => {
            const total = Object.values(snap.totals).reduce((s, v) => s + v, 0);
            return (
              <li key={snap.id} className="rounded-control border border-line/5 bg-raise/[.02] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink-100">
                    {snap.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[0.6875rem] text-ink-600">
                    {new Date(snap.at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <ul className="mt-2 space-y-1">
                  {state.players
                    .filter((p) => snap.totals[p.id] != null)
                    .map((player) => {
                      const units = snap.totals[player.id] ?? 0;
                      return (
                        <li
                          key={player.id}
                          className="flex items-baseline justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate text-ink-400">{player.name}</span>
                          <span className="num shrink-0 whitespace-nowrap text-ink-200">
                            {formatUnits(units, state.scale)}
                            {state.scale.kind === 'points' && (
                              <span className="ml-1.5 text-ink-600">
                                {formatMoney(unitsToCents(units, state.scale))}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                </ul>

                <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-line/5 pt-2 text-xs">
                  <ConfirmButton
                    className="rounded px-1.5 py-0.5 text-ink-600 transition hover:bg-red-500/15 hover:text-red-300"
                    confirmLabel="✓"
                    onConfirm={() => dispatch({ type: 'removeSnapshot', id: snap.id })}
                  >
                    delete
                  </ConfirmButton>
                  <span className="num shrink-0 whitespace-nowrap text-ink-400">
                    {formatUnits(total, state.scale)} counted
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function defaultLabel(existing: number): string {
  return `Snapshot ${existing + 1}`;
}
