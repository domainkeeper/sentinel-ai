import type { ElementType, ReactNode } from 'react';

/** Gradient-clipped text with a fallback solid color when gradient unsupported. */
export function GradientText({
  as: Tag = 'span',
  children,
  className = '',
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return <Tag className={`gradient-text ${className}`.trim()}>{children}</Tag>;
}

export default GradientText;