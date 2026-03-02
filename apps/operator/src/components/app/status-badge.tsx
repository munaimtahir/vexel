import { StatusBadge, statusToneFromValue, type StatusTone } from '@vexel/ui-system';

const ENCOUNTER_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  registered: { label: 'Registered', tone: 'neutral' },
  lab_ordered: { label: 'Ordered', tone: 'blue' },
  specimen_collected: { label: 'Collected', tone: 'amber' },
  specimen_received: { label: 'Received', tone: 'amber' },
  partial_resulted: { label: 'Partial Result', tone: 'blue' },
  resulted: { label: 'Resulted', tone: 'green' },
  verified: { label: 'Verified', tone: 'blue' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

const DOC_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  RENDERING: { label: 'Rendering', tone: 'amber' },
  RENDERED: { label: 'Rendered', tone: 'blue' },
  PUBLISHED: { label: 'Published', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
};

function fallbackTone(status: string): StatusTone {
  const mapped = statusToneFromValue(status);
  if (mapped !== 'neutral') return mapped;

  const s = status.toUpperCase();
  if (['RESULTED', 'COMPLETED', 'ACTIVE'].includes(s)) return 'green';
  if (['REJECTED', 'CANCELLED', 'ERROR', 'INACTIVE'].includes(s)) return 'red';
  if (['IN_PROGRESS', 'COLLECTED', 'RENDERING', 'PENDING'].includes(s)) return 'amber';
  if (['ORDERED', 'RECEIVED', 'QUEUED', 'RENDERED', 'SUBMITTED', 'VERIFIED'].includes(s)) return 'blue';
  return 'neutral';
}

export function EncounterStatusBadge({ status }: { status: string }) {
  const cfg = ENCOUNTER_STATUS[status] ?? { label: status, tone: fallbackTone(status) };
  return <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS[status] ?? { label: status, tone: fallbackTone(status) };
  return <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>;
}

export function DueBadge({ amount }: { amount?: number | null }) {
  if (!amount || amount <= 0) return null;
  return (
    <StatusBadge tone="red" className="font-bold">
      DUE Rs{amount.toLocaleString()}
    </StatusBadge>
  );
}
