import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { formatDuration, remainingMs } from '@/lib/clock';
import { formatUnits } from '@/lib/money';
import { playLevelNumber } from '@/lib/blinds';
import { useDispatch, useGameState } from '@/state/store';
import { CaretLeft, CaretRight, ListNumbers, Pause, Play } from '@phosphor-icons/react';
import { SPRING, haptic } from '@/lib/motion';
import { Card, SectionTitle, ShellCard } from './Ui';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { LevelSchedule } from './LevelSchedule';
import { useAlarm } from './useAlarm';

export function TournamentClock() {
  const state = useGameState();
  const dispatch = useDispatch();
  const { play, unlock } = useAlarm();
  const [now, setNow] = useState(() => Date.now());
  const [showSchedule, setShowSchedule] = useState(false);
  const reduced = useReducedMotion();
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

    // Sound, buzz and the level change all land on the same frame, so they read
    // as one event rather than three things that happened near each other.
    if (next) {
      play(next.isBreak ? 'break' : 'level');
      haptic('level');
      dispatch({ type: 'clockGoto', index: state.clock.levelIndex + 1 });
    } else {
      play('break');
      haptic('level');
      dispatch({ type: 'clockPause' });
    }
  }, [running, left, next, play, dispatch, state.clock.levelIndex]);

  useEffect(() => {
    firedFor.current = null;
  }, [state.clock.levelIndex]);

  if (!level) {
    return (
      <Card>
        <SectionTitle title="Clock" hint="No blind schedule yet. Generate one in Setup." />
      </Card>
    );
  }

  const urgent = left <= 60_000 && running;
  const playNumber = playLevelNumber(levels, state.clock.levelIndex);

  return (
    <ShellCard coreClassName="">
      <div
        className={`px-4 pb-5 pt-6 text-center transition-colors duration-500 ease-standard sm:px-5 ${
          level.isBreak ? 'bg-gold-500/[.07]' : urgent ? 'bg-red-500/[.07]' : ''
        }`}
      >
        <div className="type-label text-xs font-medium text-ink-400">
          {level.isBreak ? 'Break' : `Level ${playNumber}`}
        </div>

        <div
          className={`num type-display mt-1.5 text-[4.25rem] font-semibold sm:text-[5rem] ${
            urgent ? 'animate-breathe text-red-300' : 'text-ink-50'
          }`}
        >
          {formatDuration(left)}
        </div>

        {!level.isBreak && (
          <div className="num type-title mt-3 text-2xl font-semibold text-felt-300">
            {formatUnits(level.smallBlind, state.scale)} / {formatUnits(level.bigBlind, state.scale)}
            {level.ante > 0 && (
              <span className="ml-2 text-base font-medium text-gold-400">
                ante {formatUnits(level.ante, state.scale)}
              </span>
            )}
          </div>
        )}

        {next && (
          <div className="type-body mt-2.5 text-xs text-ink-500">
            Next:{' '}
            {next.isBreak
              ? `${next.minutes} min break`
              : `${formatUnits(next.smallBlind, state.scale)} / ${formatUnits(next.bigBlind, state.scale)}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 border-y border-white/[.06] bg-black/20">
        <Pressable
          depth="lg"
          feedback="select"
          className="flex items-center justify-center border-r border-white/[.06] py-3.5 text-ink-400 transition-colors duration-200 ease-standard hover:bg-white/[.04] hover:text-ink-100 disabled:opacity-25"
          onClick={() => dispatch({ type: 'clockGoto', index: state.clock.levelIndex - 1 })}
          disabled={state.clock.levelIndex === 0}
          aria-label="Previous level"
        >
          <Icon as={CaretLeft} size={18} />
        </Pressable>

        <Pressable
          depth="lg"
          feedback="commit"
          className={`col-span-2 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors duration-200 ease-standard ${
            running
              ? 'text-ink-200 hover:bg-white/[.04]'
              : 'bg-felt-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] hover:bg-felt-600'
          }`}
          onClick={() => {
            unlock();
            dispatch({ type: running ? 'clockPause' : 'clockStart' });
          }}
        >
          <Icon as={running ? Pause : Play} size={16} weight="regular" />
          {running ? 'Pause' : left === 0 ? 'Restart level' : 'Start'}
        </Pressable>

        <Pressable
          depth="lg"
          feedback="select"
          className="flex items-center justify-center border-l border-white/[.06] py-3.5 text-ink-400 transition-colors duration-200 ease-standard hover:bg-white/[.04] hover:text-ink-100 disabled:opacity-25"
          onClick={() => dispatch({ type: 'clockGoto', index: state.clock.levelIndex + 1 })}
          disabled={state.clock.levelIndex >= levels.length - 1}
          aria-label="Next level"
        >
          <Icon as={CaretRight} size={18} />
        </Pressable>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex gap-1.5">
          <Pressable
            depth="sm"
            feedback="select"
            className="btn-ghost !px-2.5 !py-1.5 !text-xs"
            onClick={() => dispatch({ type: 'clockAdjust', deltaMs: -60_000 })}
          >
            -1 min
          </Pressable>
          <Pressable
            depth="sm"
            feedback="select"
            className="btn-ghost !px-2.5 !py-1.5 !text-xs"
            onClick={() => dispatch({ type: 'clockAdjust', deltaMs: 60_000 })}
          >
            +1 min
          </Pressable>
          <Pressable
            depth="sm"
            feedback="select"
            className="btn-ghost !px-2.5 !py-1.5 !text-xs"
            onClick={() => dispatch({ type: 'clockReset' })}
          >
            Reset
          </Pressable>
        </div>
        <Pressable
          depth="sm"
          feedback="select"
          className="btn-ghost !px-2.5 !py-1.5 !text-xs"
          onClick={() => setShowSchedule((v) => !v)}
        >
          <Icon as={ListNumbers} size={14} />
          {showSchedule ? 'Hide' : 'Schedule'}
        </Pressable>
      </div>

      <AnimatePresence initial={false}>
        {showSchedule && (
          <m.div
            initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={SPRING.sheet}
            className="overflow-hidden border-t border-white/[.06]"
          >
            <div className="px-4 py-3 sm:px-5">
              <LevelSchedule
                levels={levels}
                scale={state.scale}
                currentIndex={state.clock.levelIndex}
                onPick={(index) => dispatch({ type: 'clockGoto', index })}
              />
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </ShellCard>
  );
}
