import type { ReactNode } from 'react';

/** Kicker / pre-heading label. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

export default Eyebrow;