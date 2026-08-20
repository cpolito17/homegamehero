import { useMemo, useState } from 'react';
import { m } from 'motion/react';
import { ArrowRight, CaretDown, CaretLeft } from '@phosphor-icons/react';
import { ActionBar } from '@/components/ActionBar';
import { ChipCountEntry } from '@/components/ChipCountEntry';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { PrizeSplitEditor, ordinalSuffix } from '@/components/PrizeSplitEditor';
import {
  Card,
  ConfirmButton,
  EmptyState,
  NumberInput,
  Notices,
  SectionTitle,
  Segmented,
  Stat,
  TileGrid,
} from '@/components/Ui';
import { moneyIn, moneyOut, totalMoneyIn } from '@/lib/ledger';
import { computeCashPayout, computePrizes, finishOrderFrom, POT_ID } from '@/lib/payout';
import { formatMoney, formatSigned, formatUnits, parseUnits } from '@/lib/money';
import { SPRING } from '@/lib/motion';
import { pushHistory } from '@/lib/storage';
import type { Discrepancy } from '@/lib/types';
import { payoutUnitsFor } from '@/state/reducer';
import { useDispatch, useGameState } from '@/state/store';

export function Payout() {
  const state = useGameState();
  return state.format === 'tournament' ? <TournamentPayout /> : <CashPayout />;
}

// ---------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------

function CashPayout() {
  const state = useGameState();
  const dispatch = useDispatch();
  const [expanded, setExpanded] = useState<string | null>(null);

  const result = useMemo(
    () =>
      computeCashPayout({
        players: state.players.map((p) => ({
          id: p.id,
          chipUnits: payoutUnitsFor(state, p.id),
          buyInCents: moneyIn(state.ledger, p.id),
          cashedOutCents: moneyOut(state.ledger, p.id),
          left: Boolean(p.leftAt),
        })),
        scale: state.scale,
        resolution: state.payout.resolution,
      }),
    [state],
  );

  const remaining = state.players.filter((p) => !p.leftAt);
  const anyCounted = remaining.some((p) => payoutUnitsFor(state, p.id) > 0);
  const balanced = result.deltaCents === 0;

  return (
    <>
      <TileGrid className="pb-36">
      <Card>
        <SectionTitle
          title="Count the chips"
          hint="Enter what each player has in front of them. That's the whole job."
        />

        <Segmented
          value={state.payout.entryMode}
          options={[
            { value: 'chips', label: 'Count by colour' },
            { value: 'total', label: 'Enter a total' },
          ]}
          onChange={(mode) => dispatch({ type: 'setPayoutMode', mode })}
        />

        <div className="mt-4 space-y-2">
          {remaining.length === 0 && (
            <EmptyState title="Everyone already cashed out" hint="The results are below." />
          )}

          {remaining.map((player) => {
            const units = payoutUnitsFor(state, player.id);
            const isOpen = expanded === player.id;
            return (
              <div key={player.id} className="rounded-control border border-line/5 bg-raise/[.02] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-100">
                    {player.name}
                  </span>

                  {state.payout.entryMode === 'total' ? (
                    <NumberInput
                      value={units}
                      onCommit={(value) =>
                        dispatch({ type: 'setPayoutTotal', playerId: player.id, units: value })
                      }
                      parse={(raw) => (raw.trim() === '' ? 0 : parseUnits(raw, state.scale))}
                      format={(v) => (v > 0 ? formatUnits(v, state.scale) : '')}
                      placeholder={state.scale.kind === 'dollar' ? '$0' : '0'}
                      className="num w-28 shrink-0 !py-2 text-right !text-lg"
                      ariaLabel={`${player.name} total`}
                    />
                  ) : (
                    <Pressable
                      depth="sm"
                      feedback="select"
                      className="btn-ghost shrink-0 !py-2 !text-sm"
                      onClick={() => setExpanded(isOpen ? null : player.id)}
                      aria-expanded={isOpen}
                      aria-label={`Count ${player.name}'s chips`}
                    >
                      <span className="num font-semibold text-money-400">
                        {formatUnits(units, state.scale)}
                      </span>
                      <m.span
                        className="text-ink-500"
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={SPRING.move}
                      >
                        <Icon as={CaretDown} size={14} />
                      </m.span>
                    </Pressable>
                  )}
                </div>

                {state.payout.entryMode === 'chips' && isOpen && (
                  <div className="mt-3 border-t border-line/[.06] pt-3">
                    <ChipCountEntry
                      chipSet={state.chipSet}
                      scale={state.scale}
                      counts={state.payout.chipCounts[player.id] ?? {}}
                      excludeColorIds={state.retiredColorIds}
                      onChange={(colorId, count) =>
                        dispatch({ type: 'setPayoutChips', playerId: player.id, colorId, count })
                      }
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <ConfirmButton
            className="btn-ghost !py-2 !text-xs"
            onConfirm={() => dispatch({ type: 'clearPayoutEntries' })}
          >
            Clear counts
          </ConfirmButton>
        </div>
      </Card>

      <Card>
        <SectionTitle title="The count" />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Money in" mono value={formatMoney(result.potCents)} />
          <Stat label="Chips counted" mono value={formatMoney(result.countedCents)} />
          <Stat
            label="Difference" mono
            value={balanced ? 'Even' : formatSigned(result.deltaCents)}
            tone={balanced ? 'good' : 'bad'}
          />
        </div>

        {!balanced && anyCounted && (
          <div className="mt-4">
            <span className="label">How do you want to handle it?</span>
            <Segmented<Discrepancy>
              value={state.payout.resolution}
              options={[
                { value: 'none', label: 'Recount' },
                { value: 'scale', label: 'Scale to pot' },
                { value: 'accept', label: 'Pay as counted' },
              ]}
              onChange={(resolution) => dispatch({ type: 'setResolution', resolution })}
            />
            <p className="mt-2 text-xs leading-snug text-ink-500">
              {state.payout.resolution === 'scale'
                ? 'Everyone gets their share of the actual cash, in proportion to their chips. Totals come out even.'
                : state.payout.resolution === 'accept'
                  ? "Pay exactly what the chips say. You'll be over or under by the difference."
                  : "Nothing paid out yet, because the numbers don't agree. Recount, or pick one of the other two."}
            </p>
          </div>
        )}

        <Notices notices={result.notices} className="mt-3" />
      </Card>

      {anyCounted && (
        <>
          <Card>
            <SectionTitle title="Payouts" hint="What each player is handed." />
            <div className="space-y-1.5">
              {result.lines.map((line) => {
                const player = state.players.find((p) => p.id === line.playerId);
                return (
                  <div
                    key={line.playerId}
                    className="flex items-center justify-between gap-3 rounded-control border border-line/5 bg-raise/[.02] px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-100">
                        {player?.name}
                        {line.settled && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-money-400">
                            left early
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-ink-500">
                        in <span className="num">{formatMoney(line.buyInCents)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="num text-lg font-bold text-ink-50">
                        {formatMoney(line.payoutCents)}
                      </div>
                      <div
                        className={`num text-xs font-semibold ${
                          line.netCents > 0
                            ? 'text-money-300'
                            : line.netCents < 0
                              ? 'text-red-300'
                              : 'text-ink-500'
                        }`}
                      >
                        {formatSigned(line.netCents)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="Who pays whom"
              hint="The fewest payments that settle the night, if you're not running a central bank."
            />
            {result.transfers.length === 0 ? (
              <p className="text-sm text-ink-500">Everyone broke even. Nothing to settle.</p>
            ) : (
              <ul className="space-y-1.5">
                {result.transfers.map((transfer, i) => {
                  const nameOf = (id: string) =>
                    id === POT_ID
                      ? 'The pot'
                      : (state.players.find((p) => p.id === id)?.name ?? 'Unknown');
                  const from = { name: nameOf(transfer.fromPlayerId) };
                  const to = { name: nameOf(transfer.toPlayerId) };
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-control border border-line/5 bg-raise/[.02] px-3 py-2.5 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-100">
                        {from?.name}
                      </span>
                      <span className="shrink-0 text-ink-600">
                        <Icon as={ArrowRight} size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-100">
                        {to?.name}
                      </span>
                      <span className="num shrink-0 font-bold text-money-400">
                        {formatMoney(transfer.cents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </>
      )}

      </TileGrid>

      <FinishBar
        summaryPlayers={result.lines.map((line) => ({
          name: state.players.find((p) => p.id === line.playerId)?.name ?? 'Player',
          buyInCents: line.buyInCents,
          payoutCents: line.payoutCents,
        }))}
        potCents={result.potCents}
        disabled={!anyCounted}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tournament
// ---------------------------------------------------------------------------

function TournamentPayout() {
  const state = useGameState();
  const dispatch = useDispatch();

  const poolCents = totalMoneyIn(state.ledger);
  const finishOrder = useMemo(
    () =>
      finishOrderFrom(
        state.eliminations,
        state.players.map((p) => p.id),
      ),
    [state.eliminations, state.players],
  );

  const { prizes, notices } = useMemo(
    () => computePrizes({ poolCents, split: state.tournament.prizeSplit, finishOrder }),
    [poolCents, state.tournament.prizeSplit, finishOrder],
  );

  const stillIn = state.players.filter((p) => !state.eliminations.includes(p.id));

  return (
    <>
      <TileGrid className="pb-36">
      <Card>
        <SectionTitle title="Prize pool" hint="Every entry, rebuy, and add-on logged tonight." />
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Pool" mono value={formatMoney(poolCents)} tone="money" />
          <Stat label="Entries" mono value={state.players.length} />
          <Stat label="Still in" mono value={stillIn.length} />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Finishing order" hint="Winner first. Fix it here if the bust order got logged wrong." />
        {finishOrder.length === 0 ? (
          <EmptyState title="No players" />
        ) : (
          <ol className="space-y-1.5">
            {finishOrder.map((playerId, index) => {
              const player = state.players.find((p) => p.id === playerId);
              const prize = prizes.find((p) => p.place === index + 1);
              return (
                <li
                  key={playerId}
                  className="flex items-center gap-3 rounded-control border border-line/5 bg-raise/[.02] px-3 py-2.5"
                >
                  <span className="num w-8 shrink-0 text-sm font-bold text-ink-400">
                    {index + 1}
                    {ordinalSuffix(index + 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-100">
                    {player?.name ?? 'Unknown'}
                  </span>
                  <span className="num shrink-0 text-base font-bold text-money-400">
                    {prize ? formatMoney(prize.cents) : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-3 text-xs text-ink-500">
          Order comes from who busted when. Undo a bust back in the game screen to change it.
        </p>
      </Card>

      <Card>
        <SectionTitle title="Split" hint="Yours to set. Percentages have to add up to 100." />
        <PrizeSplitEditor
          split={state.tournament.prizeSplit}
          poolCents={poolCents}
          onChange={(split) => dispatch({ type: 'setPrizeSplit', split })}
        />
        <Notices notices={notices} className="mt-3" />
      </Card>

      </TileGrid>

      <FinishBar
        summaryPlayers={state.players.map((player) => {
          const place = finishOrder.indexOf(player.id) + 1;
          const prize = prizes.find((p) => p.place === place);
          return {
            name: player.name,
            buyInCents: moneyIn(state.ledger, player.id),
            payoutCents: prize?.cents ?? 0,
          };
        })}
        potCents={poolCents}
        disabled={notices.some((n) => n.level === 'error')}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function FinishBar({
  summaryPlayers,
  potCents,
  disabled,
}: {
  summaryPlayers: { name: string; buyInCents: number; payoutCents: number }[];
  potCents: number;
  disabled: boolean;
}) {
  const state = useGameState();
  const dispatch = useDispatch();

  const finish = () => {
    pushHistory({
      id: state.id,
      name: state.name,
      format: state.format,
      endedAt: Date.now(),
      potCents,
      players: summaryPlayers,
    });
    dispatch({ type: 'reset' });
  };

  return (
    <ActionBar note={disabled ? 'Sort the numbers above before closing the night out.' : undefined}>
      <Pressable
        depth="sm"
        className="btn-ghost shrink-0"
        onClick={() => dispatch({ type: 'setPhase', phase: 'game' })}
      >
        <Icon as={CaretLeft} size={15} />
        Back
      </Pressable>
      <ConfirmButton
        className="btn-primary flex-1 !py-2.5 text-[0.9375rem]"
        confirmLabel="Save and start over?"
        onConfirm={finish}
      >
        Finish night
      </ConfirmButton>
    </ActionBar>
  );
}
