'use client';
import { StatusBadge, statusToneFromWorkflowStatus, type StatusTone } from '@vexel/theme';

const ENCOUNTER_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  registered: { label: 'Registered', tone: 'neutral' },
  lab_ordered: { label: 'Ordered', tone: 'info' },
  specimen_collected: { label: 'Collected', tone: 'warning' },
  specimen_received: { label: 'Received', tone: 'info' },
  partial_resulted: { label: 'Partial', tone: 'warning' },
  resulted: { label: 'Resulted', tone: 'success' },
  verified: { label: 'Verified', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'destructive' },
};

const DOC_STATUS_MAP: Record<string, { label: string; tone: StatusTone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  RENDERING: { label: 'Rendering…', tone: 'warning' },
  RENDERED: { label: 'Ready', tone: 'info' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'destructive' },
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const s = ENCOUNTER_STATUS_MAP[status] ?? { label: status, tone: statusToneFromWorkflowStatus(status) };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUS_MAP[status] ?? { label: status, tone: statusToneFromWorkflowStatus(status) };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

/** Result flag badge (H/L/N/critical) — uses CSS variable tokens */
export function FlagBadge({ flag }: { flag: string | null | undefined }) {
  if (!flag) return null;
  const tone: StatusTone =
    flag === 'high' || flag === 'critical'
      ? 'destructive'
      : flag === 'low'
        ? 'info'
        : flag === 'normal'
          ? 'success'
          : 'neutral';
  const label =
    flag === 'high'     ? 'H' :
    flag === 'low'      ? 'L' :
    flag === 'normal'   ? 'N' :
    flag === 'critical' ? '!' : flag.charAt(0).toUpperCase();
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}
