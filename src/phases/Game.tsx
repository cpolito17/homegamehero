import { BankPanel } from '@/components/BankPanel';
import { ColorUpPanel } from '@/components/ColorUpPanel';
import { GamePlayers } from '@/components/GamePlayers';
import { TournamentClock } from '@/components/TournamentClock';
import { Card, SectionTitle, Stat } from '@/components/Ui';
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
    <div className="space-y-4 pb-28">
      {isTournament ? (
        <TournamentClock />
      ) : (
        <Card>
          <SectionTitle title="Stakes" hint="Fixed for the session." />
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Blinds"
              value={`${formatUnits(state.cash.smallBlind, state.scale)} / ${formatUnits(state.cash.bigBlind, state.scale)}`}
              tone="good"
            />
            <Stat label="Still playing" value={remaining} />
          </div>
        </Card>
      )}

      <ColorUpPanel />
      <GamePlayers />
      <BankPanel />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-ink-975/90 px-4 pb-[calc(0.75rem+var(--safe-b))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            className="btn-ghost shrink-0"
            onClick={() => dispatch({ type: 'setPhase', phase: 'pregame' })}
          >
            Setup
          </button>
          <button
            type="button"
            className="btn-gold flex-1 !py-3 text-base"
            onClick={() => dispatch({ type: 'setPhase', phase: 'payout' })}
          >
            Cash out the table
          </button>
        </div>
      </div>
    </div>
  );
}
