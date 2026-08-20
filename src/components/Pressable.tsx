'use client';
import { m, useReducedMotion } from 'motion/react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { SPRING, haptic, type Haptic } from '@/lib/motion';

type PressableProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'
> & {
  children: ReactNode;
  /** How far the control gives under the finger. Bigger surfaces move less. */
  depth?: 'sm' | 'md' | 'lg';
  /** Haptic fired on commit. Omit for controls that don't commit anything. */
  feedback?: Haptic;
};

const DEPTH = { sm: 0.97, md: 0.965, lg: 0.985 } as const;

/**
 * A button that responds to the press, not the click.
 *
 * The scale change starts on pointer-down, which is the moment the user
 * expects an answer. Waiting for pointer-up to acknowledge a tap is the
 * difference between a control that feels connected and one that feels dead.
 *
 * Dragging off the control before releasing cancels it, and the spring returns
 * from wherever the scale currently is rather than snapping.
 */
export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { children, depth = 'md', feedback, className = '', onClick, disabled, ...rest },
  ref,
) {
  const reduced = useReducedMotion();

  return (
    <m.button
      ref={ref}
      type="button"
      disabled={disabled}
      className={className}
      whileTap={reduced || disabled ? undefined : { scale: DEPTH[depth] }}
      transition={SPRING.press}
      onClick={(event) => {
        if (feedback) haptic(feedback);
        onClick?.(event);
      }}
      {...rest}
    >
      {children}
    </m.button>
  );
});
