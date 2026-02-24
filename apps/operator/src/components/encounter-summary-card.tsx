'use client';
import { EncounterStatusBadge } from './status-badge';

interface Props {
  encounter: any;
  patient?: any;
}

export default function EncounterSummaryCard({ encounter, patient }: Props) {
  const p = patient ?? encounter?.patient;
  const name = p ? `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() : encounter?.patientId ?? '—';
  return (
    <div className="bg-card rounded-lg px-5 py-4 shadow-card mb-5 flex gap-6 items-center flex-wrap border border-border">
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Patient</div>
        <div className="font-semibold text-foreground">{name}</div>
        {p?.mrn && <div className="text-xs text-muted-foreground">MRN: {p.mrn}</div>}
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Encounter</div>
        <div className="font-semibold text-foreground font-mono text-sm">{encounter?.id?.slice(0, 8)}…</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-0.5">Status</div>
        <EncounterStatusBadge status={encounter?.status ?? ''} />
      </div>
      {encounter?.createdAt && (
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">Date</div>
          <div className="text-sm text-muted-foreground">{new Date(encounter.createdAt).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}
