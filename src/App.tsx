import { Segmented } from '@/components/Ui';
import { Game } from '@/phases/Game';
import { Payout } from '@/phases/Payout';
import { PreGame } from '@/phases/PreGame';
import type { Phase } from '@/lib/types';
import { GameProvider, useDispatch, useGameState } from '@/state/store';

const PHASES: { value: Phase; label: string }[] = [
  { value: 'pregame', label: 'Setup' },
  { value: 'game', label: 'Game' },
  { value: 'payout', label: 'Payout' },
];

function Shell() {
  const state = useGameState();
  const dispatch = useDispatch();

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 pt-4">
      <header className="mb-4">
        <div className="mb-3 flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold tracking-tight text-ink-50">HomeGameHero</h1>
            <input
              className="w-full truncate bg-transparent text-xs text-ink-400 outline-none placeholder:text-ink-600 focus:text-ink-200"
              value={state.name}
              onChange={(e) => dispatch({ type: 'setName', name: e.target.value })}
              placeholder="Name this game"
              aria-label="Game name"
            />
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {state.format === 'cash' ? 'Cash' : 'Tournament'}
          </span>
        </div>

        <Segmented<Phase>
          value={state.phase}
          options={PHASES}
          onChange={(phase) => dispatch({ type: 'setPhase', phase })}
        />
      </header>

      <main>
        {state.phase === 'pregame' && <PreGame />}
        {state.phase === 'game' && <Game />}
        {state.phase === 'payout' && <Payout />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}
