'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const MODULES = [
  {
    id: 'lims',
    label: 'Laboratory (LIMS)',
    description: 'Registrations, sample collection, results entry, verification, reports',
    icon: '🧪',
    enabled: true,
    href: '/lims/worklist',
  },
  {
    id: 'radiology',
    label: 'Radiology',
    description: 'Radiology orders, imaging, reports',
    icon: '🩻',
    enabled: false,
    href: null,
  },
  {
    id: 'opd',
    label: 'OPD / Clinic',
    description: 'Outpatient consultations, prescriptions, follow-up',
    icon: '🏥',
    enabled: false,
    href: null,
  },
];

export default function OperatorLandingPage() {
  const router = useRouter();

  // Auto-redirect to LIMS if it's the only enabled module
  useEffect(() => {
    const enabledModules = MODULES.filter((m) => m.enabled);
    if (enabledModules.length === 1 && enabledModules[0].href) {
      const timer = setTimeout(() => {
        router.replace(enabledModules[0].href!);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px',
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#f1f5f9', margin: '0 0 8px' }}>
          Vexel Operator
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>
          Select a module to continue
        </p>
      </div>

      {/* Module switcher cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 280px)', gap: '20px', justifyContent: 'center' }}>
        {MODULES.map((mod) => (
          <div
            key={mod.id}
            onClick={() => mod.enabled && mod.href && router.push(mod.href)}
            style={{
              background: mod.enabled ? '#1e293b' : '#111827',
              border: mod.enabled ? '2px solid #3b82f6' : '2px solid #1f2937',
              borderRadius: '16px',
              padding: '28px 24px',
              cursor: mod.enabled ? 'pointer' : 'default',
              opacity: mod.enabled ? 1 : 0.5,
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              if (mod.enabled) {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(59,130,246,0.25)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>{mod.icon}</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
              {mod.label}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 20px', lineHeight: 1.5 }}>
              {mod.description}
            </p>
            {mod.enabled ? (
              <span style={{
                display: 'inline-block',
                padding: '6px 16px',
                background: '#3b82f6',
                color: 'white',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
              }}>
                Open →
              </span>
            ) : (
              <span style={{
                display: 'inline-block',
                padding: '6px 16px',
                background: '#374151',
                color: '#9ca3af',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                Coming soon
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Redirect notice */}
      <p style={{ color: '#475569', fontSize: '13px', marginTop: '40px' }}>
        Redirecting to LIMS…
      </p>
    </div>
  );
}
