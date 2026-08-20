import type { ClockState } from './types';

/** Milliseconds left in the current level, accounting for a running clock. */
export function remainingMs(clock: ClockState, now: number = Date.now()): number {
  if (!clock.runningSince) return Math.max(0, clock.remainingMs);
  return Math.max(0, clock.remainingMs - (now - clock.runningSince));
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(hours > 0 ? minutes : minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
