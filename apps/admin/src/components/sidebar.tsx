'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/tenants', label: 'Tenants', icon: '🏢' },
  { href: '/users', label: 'Users & Roles', icon: '👥' },
  { href: '/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/branding', label: 'Branding', icon: '🎨' },
  {
    href: '/catalog', label: 'Catalog', icon: '🧪',
    children: [
      { href: '/catalog/tests', label: 'Tests' },
      { href: '/catalog/parameters', label: 'Parameters' },
      { href: '/catalog/panels', label: 'Panels' },
      { href: '/catalog/import-export', label: 'Import / Export' },
    ],
  },
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
          const isParentActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  color: isParentActive ? '#f8fafc' : '#94a3b8',
                  background: isParentActive && !item.children ? '#334155' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  transition: 'background 0.15s',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
              {item.children && isParentActive && (
                <div style={{ background: '#0f172a' }}>
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          display: 'block',
                          padding: '8px 16px 8px 44px',
                          color: childActive ? '#f8fafc' : '#64748b',
                          background: childActive ? '#1e3a5f' : 'transparent',
                          textDecoration: 'none',
                          fontSize: '13px',
                          transition: 'background 0.15s',
                        }}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
