'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

type TimelineStep = {
  key: string;
  label: string;
  href: string;
};

const STEPS: TimelineStep[] = [
  { key: 'registration', label: 'Registration', href: '' },
  { key: 'order', label: 'Order', href: 'order' },
  { key: 'sample', label: 'Sample', href: 'sample' },
  { key: 'results', label: 'Results', href: 'results' },
  { key: 'verify', label: 'Verify', href: 'verify' },
  { key: 'publish', label: 'Publish', href: 'publish' },
];

function stageIndex(status?: string | null): number {
  const s = (status ?? '').toLowerCase();
  if (s === 'published') return 5;
  if (s === 'verified') return 4;
  if (s === 'resulted' || s === 'partial_resulted') return 3;
  if (s === 'specimen_received' || s === 'specimen_collected') return 2;
  if (s === 'lab_ordered') return 1;
  return 0;
}

export function EncounterTimeline({
  encounterId,
  status,
}: {
  encounterId: string;
  status?: string | null;
}) {
  const current = stageIndex(status);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="overflow-x-auto">
        <div className="flex min-w-[740px] items-center gap-2">
          {STEPS.map((step, idx) => {
            const isCurrent = idx === current;
            const isDone = idx < current;
            const isFuture = idx > current;
            const isClickable = idx <= current + 1;
            const to = step.href ? `/lims/encounters/${encounterId}/${step.href}` : `/lims/encounters/${encounterId}`;

            return (
              <div key={step.key} className="flex items-center gap-2">
                {isClickable ? (
                  <Link
                    href={to}
                    className={cn(
                      'rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors',
                      isDone && 'bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-fg))]',
                      isCurrent && 'bg-primary text-primary-foreground',
                      isFuture && 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'cursor-not-allowed rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap',
                      'bg-muted/60 text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                )}
                {idx < STEPS.length - 1 && (
                  <span
                    className={cn(
                      'h-[2px] w-6',
                      idx < current ? 'bg-[hsl(var(--status-success-fg))]' : 'bg-border',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

