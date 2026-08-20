'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from '@phosphor-icons/react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { SPRING, haptic } from '@/lib/motion';
import {
  applyTheme,
  resolveTheme,
  storeTheme,
  watchSystemTheme,
  type Theme,
} from '@/lib/theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

/**
 * One control, two states.
 *
 * The glyph swaps rather than cross-fades in place: the outgoing icon leaves the
 * way the incoming one arrives, so the switch reads as a single object turning
 * over instead of two icons blinking.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme());
  const reduced = useReducedMotion();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Follow the system until the host overrides it.
  useEffect(() => watchSystemTheme(setTheme), []);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Pressable
      depth="sm"
      feedback="select"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        haptic('select');
        storeTheme(next);
        setTheme(next);
      }}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-ink-300 outline outline-1 -outline-offset-1 outline-line/15 transition-colors hover:text-ink-50"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          key={theme}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, rotate: -35 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12, rotate: 35 }}
          transition={reduced ? { duration: 0 } : SPRING.move}
          className="flex items-center justify-center"
        >
          <Icon as={theme === 'dark' ? Moon : Sun} size={17}  />
        </m.span>
      </AnimatePresence>
    </Pressable>
  );
}
