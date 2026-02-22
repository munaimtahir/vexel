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
    <div style={{ background: 'white', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Patient</div>
        <div style={{ fontWeight: 600, color: '#1e293b' }}>{name}</div>
        {p?.mrn && <div style={{ fontSize: '12px', color: '#94a3b8' }}>MRN: {p.mrn}</div>}
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Encounter</div>
        <div style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace', fontSize: '13px' }}>{encounter?.id?.slice(0, 8)}…</div>
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Status</div>
        <EncounterStatusBadge status={encounter?.status ?? ''} />
      </div>
      {encounter?.createdAt && (
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Date</div>
          <div style={{ fontSize: '13px', color: '#475569' }}>{new Date(encounter.createdAt).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  );
}
