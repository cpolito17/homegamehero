'use client';
import type { ReactNode } from 'react';

/**
 * The bar that carries the phase's primary action.
 *
 * A translucent layer the page scrolls beneath rather than an opaque strip that
 * permanently claims a band of the viewport. The bright top edge is the light
 * the material catches, which reads as a real surface where a hairline border
 * reads as a drawn line.
 */
export function ActionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="material edge-scrim-up fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.875rem+var(--safe-b))] pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
      {/* Centred on the page at every width. The action belongs to the whole
          phase, not to the column it happens to sit beside. */}
      <div className="mx-auto max-w-2xl">
        {note && <p className="type-body mb-2 truncate text-xs text-ink-400">{note}</p>}
        <div className="flex items-center justify-center gap-2.5">{children}</div>
      </div>
    </div>
  );
}
