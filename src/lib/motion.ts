import type { Transition } from 'motion/react';

/**
 * Spring presets.
 *
 * Springs rather than fixed-duration curves because a spring animates from
 * wherever the element currently is. Grab a moving panel and it follows you
 * instead of finishing its old animation first.
 *
 * `bounce: 0` is critically damped: it settles without overshoot, which is what
 * you want for anything that simply moves. Overshoot is reserved for motion the
 * user's own gesture set going.
 */
export const SPRING = {
  /** Default for anything that repositions. Apple: damping 1.0, response 0.4. */
  move: { type: 'spring', bounce: 0, duration: 0.4 } as Transition,
  /** Press and release. Fast enough to read as instant. */
  press: { type: 'spring', bounce: 0, duration: 0.22 } as Transition,
  /** Panels and disclosures. Apple: damping 0.8, response 0.3. */
  sheet: { type: 'spring', bounce: 0.16, duration: 0.34 } as Transition,
  /** Something the user flicked or committed to. A little weight on arrival. */
  commit: { type: 'spring', bounce: 0.24, duration: 0.42 } as Transition,
} as const;

/** Reduced motion keeps the feedback and drops the travel. */
export const CROSSFADE: Transition = { duration: 0.16, ease: [0.32, 0.72, 0, 1] };

export function springFor(reduced: boolean | null, preset: Transition): Transition {
  return reduced ? CROSSFADE : preset;
}

/**
 * Reveal-on-scroll for content below the fold. `once` because a list that
 * re-animates every time it scrolls back into view is noise, not hierarchy.
 */
export const reveal = (reduced: boolean | null, index = 0) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: reduced
    ? CROSSFADE
    : { duration: 0.5, delay: Math.min(index, 6) * 0.045, ease: [0.22, 1, 0.36, 1] as const },
});

/**
 * Haptics.
 *
 * Fired on the causal event and on the same frame as the visual change, so the
 * two read as one event rather than two. Reserved for moments that actually
 * commit something: a rebuy paid out, a level turning over, a payout settled.
 * Unsupported on iOS Safari, where it degrades to nothing.
 */
export type Haptic = 'select' | 'commit' | 'warn' | 'level';

const PATTERNS: Record<Haptic, number | number[]> = {
  select: 8,
  commit: [14, 40, 22],
  warn: [30, 60, 30],
  level: [120, 80, 120],
};

export function haptic(kind: Haptic): void {
  if (typeof navigator === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate?.(PATTERNS[kind]);
}
