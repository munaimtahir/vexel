'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/tenants', label: 'Tenants', icon: '🏢' },
  { href: '/users', label: 'Users & Roles', icon: '👥' },
  { href: '/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/branding', label: 'Branding', icon: '🎨' },
  { href: '/catalog', label: 'Catalog', icon: '🧪' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
  { href: '/jobs', label: 'Jobs', icon: '⚙️' },
  { href: '/system/health', label: 'System Health', icon: '❤️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: '#1e293b',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 0',
    }}>
      <div style={{ padding: '0 16px 24px', borderBottom: '1px solid #334155' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
          Vexel Admin
        </h1>
        <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Back Office</p>
      </div>
      <nav style={{ flex: 1, padding: '16px 0' }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                color: active ? '#f8fafc' : '#94a3b8',
                background: active ? '#334155' : 'transparent',
                textDecoration: 'none',
                fontSize: '14px',
                transition: 'background 0.15s',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
