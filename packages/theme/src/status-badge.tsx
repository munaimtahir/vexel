import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        info: 'border-[hsl(var(--status-info-border))] bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))]',
        warning: 'border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))]',
        success: 'border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]',
        destructive:
          'border-[hsl(var(--status-destructive-border))] bg-[hsl(var(--status-destructive-bg))] text-[hsl(var(--status-destructive-fg))]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>['tone']>;

export function StatusBadge({
  className,
  tone,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}

export function statusToneFromWorkflowStatus(status?: string | null): StatusTone {
  const s = (status ?? '').toUpperCase();
  if (['VERIFIED', 'RESULTED', 'PUBLISHED', 'COMPLETED', 'ACTIVE'].includes(s)) return 'success';
  if (['FAILED', 'REJECTED', 'CANCELLED', 'ERROR', 'INACTIVE'].includes(s)) return 'destructive';
  if (['PARTIAL', 'PARTIAL_RESULTED', 'IN_PROGRESS', 'RENDERING', 'COLLECTED'].includes(s)) return 'warning';
  if (['ORDERED', 'RECEIVED', 'QUEUED', 'RENDERED', 'SUBMITTED'].includes(s)) return 'info';
  return 'neutral';
}
