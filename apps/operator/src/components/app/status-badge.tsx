import { StatusBadge, statusToneFromWorkflowStatus, type StatusTone } from '@vexel/theme';

const ENCOUNTER_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  registered: { label: 'Registered', tone: 'neutral' },
  lab_ordered: { label: 'Ordered', tone: 'info' },
  specimen_collected: { label: 'Collected', tone: 'warning' },
  specimen_received: { label: 'Received', tone: 'warning' },
  partial_resulted: { label: 'Partial Result', tone: 'info' },
  resulted: { label: 'Resulted', tone: 'success' },
  verified: { label: 'Verified', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'destructive' },
};

const DOC_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  RENDERING: { label: 'Rendering', tone: 'warning' },
  RENDERED: { label: 'Rendered', tone: 'info' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const cfg = ENCOUNTER_STATUS[status] ?? { label: status, tone: statusToneFromWorkflowStatus(status) };
  return <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS[status] ?? { label: status, tone: statusToneFromWorkflowStatus(status) };
  return <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>;
}

export function DueBadge({ amount }: { amount?: number | null }) {
  if (!amount || amount <= 0) return null;
  return (
    <StatusBadge tone="destructive" className="font-bold">
      DUE ₨{amount.toLocaleString()}
    </StatusBadge>
  );
}
