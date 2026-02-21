'use client';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  registered:          { bg: '#dbeafe', text: '#1d4ed8' },
  lab_ordered:         { bg: '#ede9fe', text: '#6d28d9' },
  specimen_collected:  { bg: '#fef3c7', text: '#b45309' },
  resulted:            { bg: '#d1fae5', text: '#065f46' },
  verified:            { bg: '#bbf7d0', text: '#14532d' },
  cancelled:           { bg: '#fee2e2', text: '#991b1b' },
};

interface IdentityHeaderProps {
  patient: { firstName: string; lastName: string; mrn: string };
  encounterId: string;
  status: string;
  createdAt: string;
}

export default function IdentityHeader({ patient, encounterId, status, createdAt }: IdentityHeaderProps) {
  const colors = STATUS_COLORS[status] ?? { bg: '#f1f5f9', text: '#475569' };
  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '16px 24px',
      marginBottom: '24px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '24px',
      alignItems: 'center',
    }}>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Patient</p>
        <p style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
          {patient.firstName} {patient.lastName}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>MRN: {patient.mrn}</p>
      </div>
      <div style={{ minWidth: '140px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Encounter</p>
        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{encounterId.slice(0, 8)}…</p>
      </div>
      <div style={{ minWidth: '120px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Status</p>
        <span style={{
          display: 'inline-block',
          marginTop: '4px',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600,
          background: colors.bg,
          color: colors.text,
        }}>
          {status}
        </span>
      </div>
      <div style={{ minWidth: '120px' }}>
        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Created</p>
        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
          {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
