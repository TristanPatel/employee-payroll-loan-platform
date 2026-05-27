import * as React from 'react';
import { cn } from '@/lib/cn';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ className, required, children, ...rest }: LabelProps) {
  return (
    <label
      className={cn('block text-xs font-medium uppercase tracking-wide text-ink-muted', className)}
      {...rest}
    >
      {children}
      {required ? <span className="ml-1 text-status-danger">*</span> : null}
    </label>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-status-danger">{message}</p>;
}

export function FieldHelp({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-ink-muted">{children}</p>;
}
