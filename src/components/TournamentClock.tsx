import { useEffect, useRef, useState } from 'react';
import { formatDuration, remainingMs } from '@/lib/clock';
import { formatUnits } from '@/lib/money';
import { playLevelNumber } from '@/lib/blinds';
import { useDispatch, useGameState } from '@/state/store';
import { Card, SectionTitle } from './Ui';
import { LevelSchedule } from './LevelSchedule';
import { useAlarm } from './useAlarm';

export function TournamentClock() {
  const state = useGameState();
  const dispatch = useDispatch();
  const { play, unlock } = useAlarm();
  const [now, setNow] = useState(() => Date.now());
  const [showSchedule, setShowSchedule] = useState(false);
  const firedFor = useRef<number | null>(null);

  const levels = state.tournament.levels;
  const level = levels[state.clock.levelIndex];
  const next = levels[state.clock.levelIndex + 1];
  const running = state.clock.runningSince != null;
  const left = remainingMs(state.clock, now);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Roll over to the next level the moment the clock runs out.
  useEffect(() => {
    if (!running || left > 0) return;
    if (firedFor.current === state.clock.levelIndex) return;
    firedFor.current = state.clock.levelIndex;

    if (next) {
      play(next.isBreak ? 'break' : 'level');
      dispatch({ type: 'clockGoto', index: state.clock.levelIndex + 1 });
    } else {
      play('break');
      dispatch({ type: 'clockPause' });
    }
  }, [running, left, next, play, dispatch, state.clock.levelIndex]);

  useEffect(() => {
    firedFor.current = null;
  }, [state.clock.levelIndex]);

  if (!level) {
    return (
      <Card>
        <SectionTitle title="Clock" hint="No blind schedule — generate one in Pre-Game." />
      </Card>
    );
  }

  const urgent = left <= 60_000 && running;
  const playNumber = playLevelNumber(levels, state.clock.levelIndex);

  return (
    <Card className="!p-0 overflow-hidden">
      <div
        className={`px-4 pb-4 pt-5 text-center transition-colors sm:px-5 ${
          level.isBreak ? 'bg-gold-500/10' : urgent ? 'bg-red-500/10' : ''
        }`}
      >
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">
          {level.isBreak ? 'Break' : `Level ${playNumber}`}
        </div>

        <div
          className={`num mt-1 text-6xl font-bold leading-none tabular-nums sm:text-7xl ${
            urgent ? 'animate-pulse-ring text-red-300' : 'text-ink-50'
          }`}
        >
          {formatDuration(left)}
        </div>

        {!level.isBreak && (
          <div className="num mt-3 text-2xl font-semibold text-felt-300">
            {formatUnits(level.smallBlind, state.scale)} / {formatUnits(level.bigBlind, state.scale)}
            {level.ante > 0 && (
              <span className="ml-2 text-base font-medium text-gold-400">
                ante {formatUnits(level.ante, state.scale)}
              </span>
            )}
          </div>
        )}

        {next && (
          <div className="mt-2 text-xs text-ink-500">
            Next:{' '}
            {next.isBreak
              ? `${next.minutes} min break`
              : `${formatUnits(next.smallBlind, state.scale)} / ${formatUnits(next.bigBlind, state.scale)}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-px border-t border-white/5 bg-white/5">
        <button
          type="button"
          className="bg-ink-950 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-900"
          onClick={() => dispatch({ type: 'clockGoto', index: state.clock.levelIndex - 1 })}
          disabled={state.clock.levelIndex === 0}
        >
          ‹ Prev
        </button>
        <button
          type="button"
          className={`col-span-2 py-3 text-sm font-semibold transition ${
            running ? 'bg-ink-950 text-ink-200 hover:bg-ink-900' : 'bg-felt-600 text-white hover:bg-felt-500'
          }`}
          onClick={() => {
            unlock();
            dispatch({ type: running ? 'clockPause' : 'clockStart' });
          }}
        >
          {running ? 'Pause' : left === 0 ? 'Restart level' : 'Start'}
        </button>
        <button
          type="button"
          className="bg-ink-950 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-900"
          onClick={() => dispatch({ type: 'clockGoto', index: state.clock.levelIndex + 1 })}
          disabled={state.clock.levelIndex >= levels.length - 1}
        >
          Next ›
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
        <div className="flex gap-1.5">
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-1.5 !text-xs"
            onClick={() => dispatch({ type: 'clockAdjust', deltaMs: -60_000 })}
          >
            −1m
          </button>
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-1.5 !text-xs"
            onClick={() => dispatch({ type: 'clockAdjust', deltaMs: 60_000 })}
          >
            +1m
          </button>
          <button
            type="button"
            className="btn-ghost !px-2.5 !py-1.5 !text-xs"
            onClick={() => dispatch({ type: 'clockReset' })}
          >
            Reset
          </button>
        </div>
        <button
          type="button"
          className="btn-ghost !px-2.5 !py-1.5 !text-xs"
          onClick={() => setShowSchedule((v) => !v)}
        >
          {showSchedule ? 'Hide' : 'Schedule'}
        </button>
      </div>

      {showSchedule && (
        <div className="border-t border-white/5 px-4 py-3 sm:px-5">
          <LevelSchedule
            levels={levels}
            scale={state.scale}
            currentIndex={state.clock.levelIndex}
            onPick={(index) => dispatch({ type: 'clockGoto', index })}
          />
        </div>
      )}
    </Card>
  );
}
