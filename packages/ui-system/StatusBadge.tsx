import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'border-border bg-muted text-muted-foreground',
      amber: 'border-[hsl(var(--status-warning-border))] bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-fg))]',
      blue: 'border-[hsl(var(--status-info-border))] bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-fg))]',
      green: 'border-[hsl(var(--status-success-border))] bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]',
      red: 'border-[hsl(var(--status-destructive-border))] bg-[hsl(var(--status-destructive-bg))] text-[hsl(var(--status-destructive-fg))]',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

export type StatusTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

const STATUS_TONE_MAP: Record<string, StatusTone> = {
  draft: 'neutral',
  pending: 'amber',
  verified: 'blue',
  published: 'green',
  failed: 'red',
};

export function statusToneFromValue(value?: string | null): StatusTone {
  const key = (value ?? '').trim().toLowerCase();
  return STATUS_TONE_MAP[key] ?? 'neutral';
}

export function StatusBadge({
  tone,
  status,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone; status?: string | null }) {
  const resolvedTone = tone ?? statusToneFromValue(status);
  return (
    <span className={cn(badgeVariants({ tone: resolvedTone }), className)} {...props}>
      {children ?? status}
    </span>
  );
}
