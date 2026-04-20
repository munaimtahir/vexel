import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type WorkflowTestChip = {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'flagged' | 'verified';
};

const STATUS_META: Record<WorkflowTestChip['status'], { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'chip-neutral',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'chip-info',
  },
  completed: {
    label: 'Completed',
    className: 'chip-success',
  },
  flagged: {
    label: 'Flagged',
    className: 'chip-destructive',
  },
  verified: {
    label: 'Verified',
    className: 'chip-success',
  },
};

export interface WorkflowCardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
}

interface WorkflowEncounterCardProps {
  patientName: string;
  ageGender: string;
  mrn: string;
  encounterCode: string;
  timeLabel: string;
  priority?: string | null;
  department?: string | null;
  tests: WorkflowTestChip[];
  totalTests: number;
  completedTests: number;
  pendingTests: number;
  actions: WorkflowCardAction[];
  className?: string;
}

export function WorkflowEncounterCard(props: WorkflowEncounterCardProps) {
  const {
    patientName,
    ageGender,
    mrn,
    encounterCode,
    timeLabel,
    priority,
    department,
    tests,
    totalTests,
    completedTests,
    pendingTests,
    actions,
    className,
  } = props;

  return (
    <Card className={cn('h-full min-h-[300px] flex flex-col', className)}>
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{patientName}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {ageGender} · MR# {mrn}
            </p>
          </div>
          {priority ? <Badge variant="warning">{priority.toUpperCase()}</Badge> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">Slip: {encounterCode}</span>
          <span>•</span>
          <span>{timeLabel}</span>
          {department ? (
            <>
              <span>•</span>
              <span>{department}</span>
            </>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="pt-3 flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tests.map((test) => {
            const status = STATUS_META[test.status];
            return (
              <span
                key={test.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  status.className,
                )}
              >
                <span>{test.label}</span>
                <span className="opacity-80">· {status.label}</span>
              </span>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center mt-auto">
          <div className="rounded-md border border-border p-2">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-sm font-semibold">{totalTests}</div>
          </div>
          <div className="rounded-md border border-border p-2">
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-sm font-semibold">{completedTests}</div>
          </div>
          <div className="rounded-md border border-border p-2">
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="text-sm font-semibold">{pendingTests}</div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0 gap-2 flex-wrap">
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.variant ?? 'default'}
            onClick={action.onClick}
            disabled={action.disabled || action.loading}
          >
            {action.loading ? `${action.label}…` : action.label}
          </Button>
        ))}
      </CardFooter>
    </Card>
  );
}
