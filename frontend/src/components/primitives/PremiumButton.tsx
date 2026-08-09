import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PremiumButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
}

/** Styled action button with accent glow and hover lift. */
export function PremiumButton({ children, variant = 'primary', className = '', ...rest }: PremiumButtonProps) {
  return (
    <button type={rest.type ?? 'button'} className={`pbtn pbtn--${variant} ${className}`.trim()} {...rest}>
      <span className="pbtn__bg" aria-hidden="true" />
      <span className="pbtn__label">{children}</span>
    </button>
  );
}

export default PremiumButton;