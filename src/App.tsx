'use client';
import { useRef } from 'react';
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react';
import { Segmented } from '@/components/Ui';
import { Game } from '@/phases/Game';
import { Payout } from '@/phases/Payout';
import { PreGame } from '@/phases/PreGame';
import { SPRING } from '@/lib/motion';
import type { Phase } from '@/lib/types';
import { GameProvider, useDispatch, useGameState } from '@/state/store';

const PHASES: { value: Phase; label: string }[] = [
  { value: 'pregame', label: 'Setup' },
  { value: 'game', label: 'Game' },
  { value: 'payout', label: 'Payout' },
];

const ORDER: Phase[] = ['pregame', 'game', 'payout'];

function Shell() {
  const state = useGameState();
  const dispatch = useDispatch();
  const reduced = useReducedMotion();
  const previous = useRef<Phase>(state.phase);

  // Phases sit in a fixed order, so a move forward leaves to the left and a move
  // back leaves to the right. A panel that arrives from one side and departs
  // from another loses the thread of where you are.
  const direction = ORDER.indexOf(state.phase) >= ORDER.indexOf(previous.current) ? 1 : -1;
  previous.current = state.phase;

  const slide = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: direction * 22 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -22 },
      };

  // The game phase carries a reference rail beside the main column.
  const wide = state.phase === 'game';

  return (
    <div className={`mx-auto min-h-full w-full px-4 ${wide ? 'max-w-2xl lg:max-w-[64rem]' : 'max-w-2xl'}`}>
      <header className="pt-5">
        <div className="mb-3 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-inner" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="type-title text-sm font-semibold text-ink-50">HomeGameHero</h1>
            <input
              className="type-body w-full truncate bg-transparent text-xs text-ink-400 outline-none placeholder:text-ink-600 focus:text-ink-200"
              value={state.name}
              onChange={(e) => dispatch({ type: 'setName', name: e.target.value })}
              placeholder="Name this game"
              aria-label="Game name"
            />
          </div>
          <span className="type-label shrink-0 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium text-ink-400 outline outline-1 -outline-offset-1 outline-white/10">
            {state.format === 'cash' ? 'Cash' : 'Tournament'}
          </span>
        </div>
      </header>

      {/* The phase switch stays reachable while everything scrolls beneath it. */}
      <div className="material edge-scrim sticky top-0 z-30 -mx-4 px-4 pb-2.5 pt-2.5">
        <Segmented<Phase>
          value={state.phase}
          options={PHASES}
          onChange={(phase) => dispatch({ type: 'setPhase', phase })}
        />
      </div>

      <main className="pt-4">
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={state.phase} {...slide} transition={SPRING.move}>
            {state.phase === 'pregame' && <PreGame />}
            {state.phase === 'game' && <Game />}
            {state.phase === 'payout' && <Payout />}
          </m.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LazyMotion features={domAnimation} strict>
      <GameProvider>
        <Shell />
      </GameProvider>
    </LazyMotion>
  );
}
