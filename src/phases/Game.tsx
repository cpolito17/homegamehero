import { BankPanel } from '@/components/BankPanel';
import { ColorUpPanel } from '@/components/ColorUpPanel';
import { GamePlayers } from '@/components/GamePlayers';
import { SnapshotPanel } from '@/components/SnapshotPanel';
import { TournamentClock } from '@/components/TournamentClock';
import { CaretLeft } from '@phosphor-icons/react';
import { ActionBar } from '@/components/ActionBar';
import { Icon } from '@/components/Icon';
import { Pressable } from '@/components/Pressable';
import { ActionButton, Card, SectionTitle, Stat } from '@/components/Ui';
import { formatUnits } from '@/lib/money';
import { useDispatch, useGameState } from '@/state/store';

export function Game() {
  const state = useGameState();
  const dispatch = useDispatch();
  const isTournament = state.format === 'tournament';

  const remaining = state.players.filter(
    (p) => !p.leftAt && !state.eliminations.includes(p.id),
  ).length;

  return (
    <>
      {/* The box is reference material the host checks constantly while working
          down the table, so on a wide screen it sits alongside rather than at the
          end of a scroll. Narrow screens keep the single column. */}
      <div className="pb-32 lg:grid lg:grid-cols-[minmax(0,1fr)_19.5rem] lg:items-start lg:gap-5">
        <div className="space-y-4">
          {isTournament ? (
            <TournamentClock />
          ) : (
            <Card>
              <SectionTitle title="Stakes" hint="Fixed for the session." />
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Blinds" mono
                  value={`${formatUnits(state.cash.smallBlind, state.scale)} / ${formatUnits(state.cash.bigBlind, state.scale)}`}
                  tone="good"
                />
                <Stat label="Still playing" mono value={remaining} />
              </div>
            </Card>
          )}

          <ColorUpPanel />
          <GamePlayers />
        </div>

        <aside className="mt-4 space-y-4 lg:sticky lg:top-[4.5rem] lg:mt-0 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto lg:pb-2 lg:[scrollbar-width:thin]">
          <BankPanel />
          <SnapshotPanel />
        </aside>
      </div>

      <ActionBar>
        <Pressable
          depth="sm"
          className="btn-ghost shrink-0"
          onClick={() => dispatch({ type: 'setPhase', phase: 'pregame' })}
        >
          <Icon as={CaretLeft} size={15} />
          Setup
        </Pressable>
        <ActionButton onClick={() => dispatch({ type: 'setPhase', phase: 'payout' })}>
          Cash out the table
        </ActionButton>
      </ActionBar>
    </>
  );
}
