'use client';

type EncounterStatus = 'registered' | 'lab_ordered' | 'specimen_collected' | 'specimen_received' | 'resulted' | 'verified' | 'cancelled';
type DocumentStatus = 'DRAFT' | 'RENDERING' | 'RENDERED' | 'PUBLISHED' | 'FAILED';

const ENCOUNTER_STATUS_MAP: Record<EncounterStatus, { label: string; bg: string; color: string }> = {
  registered: { label: 'Registered', bg: '#f0f9ff', color: '#0369a1' },
  lab_ordered: { label: 'Ordered', bg: '#fef9c3', color: '#a16207' },
  specimen_collected: { label: 'Collected', bg: '#fff7ed', color: '#c2410c' },
  specimen_received: { label: 'Received', bg: '#e0f2fe', color: '#0369a1' },
  resulted: { label: 'Resulted', bg: '#f0fdf4', color: '#15803d' },
  verified: { label: 'Verified', bg: '#ede9fe', color: '#7c3aed' },
  cancelled: { label: 'Cancelled', bg: '#f9fafb', color: '#9ca3af' },
};

const DOC_STATUS_MAP: Record<DocumentStatus, { label: string; bg: string; color: string }> = {
  DRAFT: { label: 'Draft', bg: '#f3f4f6', color: '#6b7280' },
  RENDERING: { label: 'Rendering...', bg: '#fef9c3', color: '#a16207' },
  RENDERED: { label: 'Ready', bg: '#f0f9ff', color: '#0369a1' },
  PUBLISHED: { label: 'Published', bg: '#f0fdf4', color: '#15803d' },
  FAILED: { label: 'Failed', bg: '#fef2f2', color: '#dc2626' },
};

export function EncounterStatusBadge({ status }: { status: string }) {
  const s = ENCOUNTER_STATUS_MAP[status as EncounterStatus] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

export function DocumentStatusBadge({ status }: { status: string }) {
  const s = DOC_STATUS_MAP[status as DocumentStatus] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 500, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
