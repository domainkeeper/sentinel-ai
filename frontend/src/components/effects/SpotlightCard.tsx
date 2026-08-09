import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';

interface SpotlightCardProps {
  children: ReactNode;
  as?: 'article' | 'div' | 'li' | 'section';
  className?: string;
  /** Where the radial spot sits. Default: top-center of card. */
  spot?: 'top' | 'mouse';
}

/**
 * A card with a subtle radial gloss. With `spot="mouse"` the highlight
 * follows the cursor using inline CSS variables (no per-frame re-render).
 */
export function SpotlightCard({
  children,
  as = 'div',
  className = '',
  spot = 'top',
}: SpotlightCardProps) {
  const ref = useRef<HTMLElement | null>(null);
  const Tag = as;

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`spot-card spot-card--${spot} ${className}`.trim()}
      onMouseMove={spot === 'mouse' ? onMouseMove : undefined}
    >
      {children}
    </Tag>
  );
}

export default SpotlightCard;