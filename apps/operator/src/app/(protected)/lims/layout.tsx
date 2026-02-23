'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { clearTokens } from '@/lib/auth';
import { useFeatureFlags, isVerificationVisible } from '@/hooks/use-feature-flags';

const BASE_NAV_ITEMS = [
  { label: 'Worklist', href: '/lims/worklist', icon: '📋' },
  { label: 'New Registration', href: '/lims/registrations/new', icon: '➕' },
  { label: 'Sample Collection', href: '/lims/sample-collection', icon: '🧪' },
  { label: 'Results', href: '/lims/results', icon: '📊' },
  { label: 'Encounters', href: '/lims/encounters', icon: '🏥' },
  { label: 'Patients', href: '/lims/patients', icon: '👤' },
];

function LimsSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { flags } = useFeatureFlags();

  const navItems = isVerificationVisible(flags)
    ? [
        ...BASE_NAV_ITEMS.slice(0, 4),
        { label: 'Verification', href: '/lims/verification', icon: '✅' },
        ...BASE_NAV_ITEMS.slice(4),
        { label: 'Reports', href: '/lims/reports', icon: '📄' },
      ]
    : [
        ...BASE_NAV_ITEMS,
        { label: 'Reports', href: '/lims/reports', icon: '📄' },
      ];

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  return (
    <aside style={{ width: '220px', background: '#1e293b', color: 'white', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Module switcher header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vexel Operator</p>
        </Link>
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ padding: '3px 10px', background: '#1d4ed8', color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
            🧪 LIMS
          </span>
          <span style={{ padding: '3px 10px', background: '#1f2937', color: '#4b5563', borderRadius: '4px', fontSize: '12px' }} title="Coming soon">
            Radiology
          </span>
          <span style={{ padding: '3px 10px', background: '#1f2937', color: '#4b5563', borderRadius: '4px', fontSize: '12px' }}>
            OPD
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/lims/registrations/new' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 20px',
                color: isActive ? '#f1f5f9' : '#94a3b8',
                background: isActive ? '#334155' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span style={{ fontSize: '15px' }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: '1px solid #334155' }}>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '8px 0', background: 'transparent', border: '1px solid #475569', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export default function LimsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <LimsSidebar />
      <main style={{ flex: 1, padding: '32px', background: '#f8fafc', overflowY: 'auto', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
