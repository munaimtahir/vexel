import { StatusBadge, statusToneFromValue, type StatusTone } from '@vexel/ui-system';

const ENCOUNTER_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  registered: { label: 'Registered', tone: 'neutral' },
  lab_ordered: { label: 'Lab Ordered', tone: 'blue' },
  specimen_collected: { label: 'Specimen Collected', tone: 'amber' },
  specimen_received: { label: 'Specimen Received', tone: 'amber' },
  resulted: { label: 'Resulted', tone: 'green' },
  verified: { label: 'Verified', tone: 'blue' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

const DOCUMENT_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  QUEUED: { label: 'Queued', tone: 'neutral' },
  RENDERING: { label: 'Rendering', tone: 'amber' },
  RENDERED: { label: 'Rendered', tone: 'blue' },
  PUBLISHED: { label: 'Published', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
};

function toneFromStatus(status: string): StatusTone {
  const mapped = statusToneFromValue(status);
  return mapped;
}

export function EncounterStatusBadge({ status }: { status: string }) {
  const s = ENCOUNTER_STATUS_MAP[status] ?? { label: status || '-', tone: toneFromStatus(status) };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const s = DOCUMENT_STATUS_MAP[status] ?? { label: status || '-', tone: toneFromStatus(status) };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function FlagBadge({ flag }: { flag: string | null | undefined }) {
  const upper = (flag ?? '').toUpperCase();
  const tone: StatusTone =
    upper === 'HIGH' || upper === 'PANIC_HIGH' || upper === 'PANIC_LOW'
      ? 'red'
      : upper === 'LOW'
        ? 'amber'
        : 'green';
  const label = upper || 'NORMAL';
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
