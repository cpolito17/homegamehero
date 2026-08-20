import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

/**
 * Icons follow the same optical rule as type: the larger they get, the lighter
 * they want to be. One rule, applied automatically, so weights never drift from
 * component to component.
 */
export function Icon({
  as: Glyph,
  size = 18,
  className = '',
  weight,
}: {
  as: PhosphorIcon;
  size?: number;
  className?: string;
  weight?: 'light' | 'regular';
}) {
  return (
    <Glyph
      size={size}
      weight={weight ?? (size >= 20 ? 'light' : 'regular')}
      className={className}
      aria-hidden
    />
  );
}
