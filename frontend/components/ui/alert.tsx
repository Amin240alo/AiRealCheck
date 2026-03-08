import * as React from 'react';
import { cn } from '@/lib/utils';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'error' | 'success' | 'warning' | 'info';
}

export function Alert({ className, variant = 'error', children, ...props }: AlertProps) {
  const variants = {
    error: 'bg-[var(--color-danger-muted)] border-[var(--color-danger)] text-[var(--color-danger)]',
    success: 'bg-[var(--color-success-muted)] border-[var(--color-success)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-muted)] border-[var(--color-warning)] text-[var(--color-warning)]',
    info: 'bg-[var(--color-primary-muted)] border-[var(--color-primary)] text-[var(--color-primary)]',
  };
  return (
    <div
      role="alert"
      className={cn(
        'px-4 py-3 rounded-[var(--radius-md)] border text-[13px]',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
