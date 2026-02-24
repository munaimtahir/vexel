import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ENCOUNTER_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive' }> = {
  registered:          { label: 'Registered',     variant: 'secondary' },
  lab_ordered:         { label: 'Ordered',         variant: 'info' },
  specimen_collected:  { label: 'Collected',       variant: 'warning' },
  specimen_received:   { label: 'Received',        variant: 'warning' },
  partial_resulted:    { label: 'Partial',         variant: 'warning' },
  resulted:            { label: 'Resulted',        variant: 'success' },
  verified:            { label: 'Verified',        variant: 'success' },
  cancelled:           { label: 'Cancelled',       variant: 'destructive' },
};

const DOC_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive' }> = {
  QUEUED:    { label: 'Queued',    variant: 'secondary' },
  RENDERING: { label: 'Rendering', variant: 'warning' },
  RENDERED:  { label: 'Rendered',  variant: 'info' },
  PUBLISHED: { label: 'Published', variant: 'success' },
  FAILED:    { label: 'Failed',    variant: 'destructive' },
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const cfg = ENCOUNTER_STATUS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const cfg = DOC_STATUS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function DueBadge({ amount }: { amount?: number | null }) {
  if (!amount || amount <= 0) return null;
  return <Badge variant="destructive">DUE ₨{amount.toLocaleString()}</Badge>;
}
