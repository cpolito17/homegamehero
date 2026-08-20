import { useState } from 'react';
import { countUnits } from '@/lib/chips';
import { moneyIn, moneyOut, playerChipsReceived, rebuyCount } from '@/lib/ledger';
import { formatMoney, formatSigned, parseMoney, unitsToCents } from '@/lib/money';
import type { ChipCount, Player } from '@/lib/types';
import { stackUnitsFor } from '@/state/reducer';
import { useDispatch, useGameState } from '@/state/store';
import { ChipCountEntry } from './ChipCountEntry';
import { ChipStackView } from './Chips';
import { Card, Field, NumberInput, SectionTitle } from './Ui';

type OpenPanel = { playerId: string; kind: 'rebuy' | 'cashout' } | null;

export function GamePlayers() {
  const state = useGameState();
  const dispatch = useDispatch();
  const [open, setOpen] = useState<OpenPanel>(null);

  const isTournament = state.format === 'tournament';

  return (
    <Card>
      <SectionTitle
        title="At the table"
        hint={
          isTournament
            ? 'Log rebuys and mark players out as they bust.'
            : 'Log rebuys, and cash someone out when they leave early.'
        }
      />

      <div className="space-y-2">
        {state.players.map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            open={open?.playerId === player.id ? open.kind : null}
            onToggle={(kind) =>
              setOpen((current) =>
                current?.playerId === player.id && current.kind === kind
                  ? null
                  : { playerId: player.id, kind },
              )
            }
            onClose={() => setOpen(null)}
          />
        ))}
      </div>

      <button
        type="button"
        className="btn-ghost mt-3 !py-2 !text-xs"
        onClick={() => dispatch({ type: 'addPlayer' })}
      >
        + Late arrival
      </button>
    </Card>
  );
}

function PlayerRow({
  player,
  open,
  onToggle,
  onClose,
}: {
  player: Player;
  open: 'rebuy' | 'cashout' | null;
  onToggle: (kind: 'rebuy' | 'cashout') => void;
  onClose: () => void;
}) {
  const state = useGameState();
  const dispatch = useDispatch();

  const isTournament = state.format === 'tournament';
  const inCents = moneyIn(state.ledger, player.id);
  const outCents = moneyOut(state.ledger, player.id);
  const rebuys = rebuyCount(state.ledger, player.id);
  const chips = playerChipsReceived(state.ledger, player.id);
  const busted = state.eliminations.includes(player.id);
  const left = Boolean(player.leftAt);

  const defaultRebuy = isTournament ? state.tournament.rebuyCents : state.cash.universalBuyInCents;
  const [rebuyAmount, setRebuyAmount] = useState(defaultRebuy);
  const [cashChips, setCashChips] = useState<ChipCount>({});

  const cashUnits = countUnits(cashChips, state.chipSet);
  const cashCents = unitsToCents(cashUnits, state.scale);

  const rebuyLocked =
    isTournament &&
    state.tournament.rebuyThroughLevel > 0 &&
    state.clock.levelIndex + 1 > state.tournament.rebuyThroughLevel;

  return (
    <div
      className={`rounded-control border p-3 transition ${
        left || busted ? 'border-white/5 bg-white/[.01] opacity-60' : 'border-white/5 bg-white/[.02]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-ink-100">{player.name}</span>
            {busted && <span className="text-[10px] font-bold uppercase text-red-300">Out</span>}
            {left && <span className="text-[10px] font-bold uppercase text-gold-400">Cashed</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs text-ink-500">
            <span>
              in <span className="num">{formatMoney(inCents)}</span>
            </span>
            {rebuys > 0 && (
              <span>
                {rebuys} rebuy{rebuys > 1 ? 's' : ''}
              </span>
            )}
            {outCents > 0 && (
              <span>
                out <span className="num">{formatMoney(outCents)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1.5">
          {!left && (
            <button
              type="button"
              className="btn-ghost !px-2.5 !py-1.5 !text-xs"
              onClick={() => onToggle('rebuy')}
              disabled={rebuyLocked && !busted}
            >
              Rebuy
            </button>
          )}
          {isTournament ? (
            <button
              type="button"
              className={`!px-2.5 !py-1.5 !text-xs ${busted ? 'btn-ghost' : 'btn-danger'}`}
              onClick={() => dispatch({ type: 'toggleElimination', playerId: player.id })}
            >
              {busted ? 'Undo' : 'Bust'}
            </button>
          ) : (
            !left && (
              <button
                type="button"
                className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                onClick={() => onToggle('cashout')}
              >
                Cash out
              </button>
            )
          )}
        </div>
      </div>

      {open === 'rebuy' && (
        <div className="mt-3 border-t border-white/[.06] pt-3">
          <Field label="Rebuy amount">
            <NumberInput
              value={rebuyAmount}
              onCommit={setRebuyAmount}
              parse={parseMoney}
              format={(v) => formatMoney(v)}
              className="num"
            />
          </Field>
          {isTournament && state.tournament.addOnEnabled && (
            <button
              type="button"
              className="btn-ghost mt-2 !py-1.5 !text-xs"
              onClick={() => setRebuyAmount(state.tournament.addOnCents)}
            >
              Use add-on ({formatMoney(state.tournament.addOnCents)})
            </button>
          )}
          <button
            type="button"
            className="btn-primary mt-3 w-full"
            onClick={() => {
              const stackUnits =
                isTournament && rebuyAmount === state.tournament.addOnCents
                  ? state.tournament.addOnStackUnits
                  : stackUnitsFor(state, rebuyAmount);
              dispatch({ type: 'rebuy', playerId: player.id, amountCents: rebuyAmount, stackUnits });
              onClose();
            }}
          >
            Give {formatMoney(rebuyAmount)} in chips
          </button>
        </div>
      )}

      {open === 'cashout' && (
        <div className="mt-3 border-t border-white/[.06] pt-3">
          <span className="label">Chips they're handing back</span>
          <ChipCountEntry
            chipSet={state.chipSet}
            scale={state.scale}
            counts={cashChips}
            excludeColorIds={state.retiredColorIds}
            onChange={(colorId, count) => setCashChips((c) => ({ ...c, [colorId]: count }))}
            compact
          />
          <div className="mt-3 flex items-center justify-between rounded-control border border-white/5 bg-white/[.02] px-3 py-2">
            <span className="text-xs text-ink-400">Pay them</span>
            <span className="num text-lg font-bold text-gold-400">{formatMoney(cashCents)}</span>
          </div>
          <p className="mt-1.5 text-xs text-ink-500">
            {formatSigned(cashCents - inCents)} on the night.
          </p>
          <button
            type="button"
            className="btn-primary mt-3 w-full"
            disabled={cashUnits <= 0}
            onClick={() => {
              dispatch({
                type: 'cashOut',
                playerId: player.id,
                amountCents: cashCents,
                chips: cashChips,
                leave: true,
              });
              setCashChips({});
              onClose();
            }}
          >
            Cash out and leave
          </button>
        </div>
      )}

      {Object.keys(chips).length > 0 && open === null && (
        <div className="mt-2">
          <ChipStackView
            counts={chips}
            chipSet={state.chipSet}
            scale={state.scale}
            summary="none"
          />
        </div>
      )}
    </div>
  );
}
