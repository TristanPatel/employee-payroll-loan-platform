import * as React from 'react';
import { cn } from '@/lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-ink-muted/20 bg-white px-3 text-sm text-ink-base placeholder:text-ink-muted/60 outline-none transition focus:border-richmond-primary focus:ring-2 focus:ring-richmond-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...rest}
      />
    );
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[80px] w-full rounded-md border border-ink-muted/20 bg-white px-3 py-2 text-sm text-ink-base placeholder:text-ink-muted/60 outline-none transition focus:border-richmond-primary focus:ring-2 focus:ring-richmond-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );
});
