'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearTokens } from '@/lib/auth';
import { useFeatureFlags, isVerificationVisible } from '@/hooks/use-feature-flags';

const BASE_NAV_ITEMS = [
  { label: 'New Registration', href: '/registrations/new', icon: '➕' },
  { label: 'Sample Collection', href: '/sample-collection', icon: '🧪' },
  { label: 'Results', href: '/results', icon: '📋' },
  { label: 'Encounters', href: '/encounters', icon: '🏥' },
  { label: 'Patients', href: '/patients', icon: '👤' },
];

export default function Sidebar({ currentPath }: { currentPath: string }) {
  const router = useRouter();
  const { flags } = useFeatureFlags();

  const navItems = isVerificationVisible(flags)
    ? [
        ...BASE_NAV_ITEMS.slice(0, 3),
        { label: 'Verification', href: '/verification', icon: '✅' },
        ...BASE_NAV_ITEMS.slice(3),
        { label: 'Reports', href: '/reports', icon: '📄' },
      ]
    : [
        ...BASE_NAV_ITEMS,
        { label: 'Reports', href: '/reports', icon: '📄' },
      ];

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  return (
    <aside style={{ width: '220px', background: 'hsl(var(--foreground))', color: 'hsl(var(--primary-foreground))', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'hsl(var(--muted))' }}>Vexel Operator</h1>
        <p style={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))', margin: '4px 0 0' }}>LIMS Workflow</p>
      </div>
      <nav style={{ flex: 1, padding: '16px 0' }}>
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href !== '/registrations/new' && currentPath.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                color: isActive ? 'hsl(var(--muted))' : 'hsl(var(--muted-foreground))',
                background: isActive ? 'hsl(var(--sidebar-accent))' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: '0 20px' }}>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '8px 0', background: 'transparent', border: '1px solid hsl(var(--muted-foreground))', borderRadius: '6px', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', fontSize: '14px' }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
