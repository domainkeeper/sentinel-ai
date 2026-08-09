import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';

interface MagneticProps {
  children: ReactNode;
  /** Max translation in px. */
  strength?: number;
  className?: string;
}

/**
 * Wraps a control and translates it slightly toward the pointer while
 * hovered — the "magnetic button" affordance. Costs are tiny (a few inline
 * style sets) and it degrades to nothing when unsupported.
 */
export function Magnetic({ children, strength = 14, className = '' }: MagneticProps) {
  const ref = useRef<HTMLSpanElement | null>(null);

  const canMagnet =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !!window.matchMedia('(pointer: fine)')?.matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)')?.matches;

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      const el = ref.current;
      if (!el || !canMagnet) return;
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      const pull = Math.min(1, dist / 120);
      el.style.transform = `translate(${dx * (strength / 50) * pull}px, ${dy * (strength / 50) * pull}px)`;
    },
    [strength, canMagnet],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'translate(0, 0)';
  }, []);

  return (
    <span
      ref={ref}
      className={`magnetic ${className}`.trim()}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </span>
  );
}

export default Magnetic;