import { useCallback, useEffect, useRef } from 'react';

/**
 * Level-change alert.
 *
 * Browsers only allow audio after a user gesture, so the context is created
 * lazily on the first tap, which in practice is the host pressing Start.
 */
export function useAlarm() {
  const contextRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!contextRef.current) contextRef.current = new Ctor();
    if (contextRef.current.state === 'suspended') void contextRef.current.resume();
    return contextRef.current;
  }, []);

  useEffect(
    () => () => {
      void contextRef.current?.close();
      contextRef.current = null;
    },
    [],
  );

  const play = useCallback(
    (pattern: 'level' | 'break' = 'level') => {
      const ctx = ensureContext();
      if (ctx) {
        const beeps = pattern === 'break' ? [0, 0.22, 0.44, 0.66] : [0, 0.22, 0.44];
        for (const offset of beeps) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = pattern === 'break' ? 660 : 880;
          const start = ctx.currentTime + offset;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.2);
        }
      }
      // Phones on silent still buzz, which is often the only signal anyone notices.
      navigator.vibrate?.(pattern === 'break' ? [120, 80, 120, 80, 240] : [120, 80, 120]);
    },
    [ensureContext],
  );

  return { play, unlock: ensureContext };
}
