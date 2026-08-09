import type { ReactNode, CSSProperties } from 'react';
import { useInView } from '../../lib/useInView';

interface RevealProps {
  children: ReactNode;
  /** Transition delay in ms, for staggered groups. */
  delay?: number;
  as?: 'div' | 'section' | 'figure' | 'article' | 'li';
  className?: string;
  style?: CSSProperties;
}

/** Fades / rises content into view once it enters the viewport. */
export function Reveal({ children, delay = 0, as = 'div', className = '', style }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`.trim()}
      style={{ ['--reveal-delay' as string]: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;