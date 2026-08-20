'use client';
import type { ReactNode } from 'react';
import { useGameState } from '@/state/store';

/**
 * The bar that carries the phase's primary action.
 *
 * A translucent layer the page scrolls beneath rather than an opaque strip that
 * permanently claims a band of the viewport. The bright top edge is the light
 * the material catches, which reads as a real surface where a hairline border
 * reads as a drawn line.
 */
export function ActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  const state = useGameState();
  // Stay lined up with the column the action belongs to, not with the rail
  // sitting beside it, so the primary button never drifts off under the box.
  const wide = state.phase === 'game';

  return (
    <div className="material edge-scrim-up fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.875rem+var(--safe-b))] pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
      <div
        className={`mx-auto ${wide ? 'max-w-2xl lg:max-w-[64rem] lg:pr-[20.75rem]' : 'max-w-2xl'}`}
      >
        {note && <p className="type-body mb-2 truncate text-xs text-ink-400">{note}</p>}
        <div className="flex items-center gap-2.5">{children}</div>
      </div>
    </div>
  );
}
