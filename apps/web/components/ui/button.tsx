import * as React from 'react';
import { cn } from '@/lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-richmond-primary text-white hover:bg-richmond-primary-dark active:bg-richmond-primary-dark disabled:bg-richmond-primary/50',
  secondary:
    'bg-white text-ink-base border border-ink-muted/20 hover:bg-surface-muted active:bg-surface-muted disabled:opacity-50',
  ghost: 'bg-transparent text-ink-base hover:bg-surface-muted disabled:opacity-50',
  danger: 'bg-status-danger text-white hover:opacity-90 disabled:opacity-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-richmond-primary/40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
});
