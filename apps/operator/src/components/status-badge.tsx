'use client';
import { Badge, type BadgeProps } from './ui/badge';

type BadgeVariant = BadgeProps['variant'];

const ENCOUNTER_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  registered:          { label: 'Registered', variant: 'secondary' },
  lab_ordered:         { label: 'Ordered',    variant: 'info' },
  specimen_collected:  { label: 'Collected',  variant: 'warning' },
  specimen_received:   { label: 'Received',   variant: 'info' },
  partial_resulted:    { label: 'Partial',    variant: 'warning' },
  resulted:            { label: 'Resulted',   variant: 'success' },
  verified:            { label: 'Verified',   variant: 'success' },
  cancelled:           { label: 'Cancelled',  variant: 'outline' },
};

const DOC_STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT:     { label: 'Draft',       variant: 'secondary' },
  RENDERING: { label: 'Rendering…',  variant: 'warning' },
  RENDERED:  { label: 'Ready',       variant: 'info' },
  PUBLISHED: { label: 'Published',   variant: 'success' },
  FAILED:    { label: 'Failed',      variant: 'destructive' },
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const s = ENCOUNTER_STATUS_MAP[status] ?? { label: status, variant: 'secondary' as BadgeVariant };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUS_MAP[status] ?? { label: status, variant: 'secondary' as BadgeVariant };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

/** Result flag badge (H/L/N/critical) — uses CSS variable tokens */
export function FlagBadge({ flag }: { flag: string | null | undefined }) {
  if (!flag) return null;
  const variant: BadgeVariant =
    flag === 'high' || flag === 'critical' ? 'destructive' :
    flag === 'low'                         ? 'info' :
    flag === 'normal'                      ? 'success' : 'secondary';
  const label =
    flag === 'high'     ? 'H' :
    flag === 'low'      ? 'L' :
    flag === 'normal'   ? 'N' :
    flag === 'critical' ? '!' : flag.charAt(0).toUpperCase();
  return <Badge variant={variant}>{label}</Badge>;
}
