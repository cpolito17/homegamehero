import { BankPanel } from '@/components/BankPanel';
import { ColorUpPanel } from '@/components/ColorUpPanel';
import { GamePlayers } from '@/components/GamePlayers';
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
    <div className="space-y-4 pb-32">
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
      <BankPanel />

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
    </div>
  );
}
