'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/tenants', label: 'Tenants', icon: '🏢' },
  {
    href: '/users', label: 'Users & Roles', icon: '👥',
    children: [
      { href: '/users', label: 'Users' },
      { href: '/roles', label: 'Roles' },
    ],
  },
  { href: '/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { href: '/branding', label: 'Branding', icon: '🎨' },
  {
    href: '/catalog', label: 'Catalog', icon: '🧪',
    children: [
      { href: '/catalog/tests', label: 'Tests' },
      { href: '/catalog/parameters', label: 'Parameters' },
      { href: '/catalog/panels', label: 'Panels' },
      { href: '/catalog/reference-ranges', label: 'Reference Ranges' },
      { href: '/catalog/import-export', label: 'Import / Export' },
    ],
  },
  {
    href: '/patients', label: 'Patients', icon: '🏥',
    children: [
      { href: '/patients', label: 'Patients' },
      { href: '/encounters', label: 'Encounters' },
    ],
  },
  { href: '/documents', label: 'Documents', icon: '📄' },
  { href: '/audit', label: 'Audit Log', icon: '📋' },
  { href: '/jobs', label: 'Jobs', icon: '⚙️' },
  { href: '/system/health', label: 'System Health', icon: '❤️' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: 'linear-gradient(175deg, hsl(243,38%,14%) 0%, hsl(240,32%,10%) 100%)',
      color: 'hsl(240,30%,96%)',
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid hsl(243,28%,18%)',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid hsl(243,28%,18%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, hsl(249,76%,58%) 0%, hsl(259,72%,55%) 100%)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', boxShadow: '0 2px 8px hsl(249 76% 58% / .35)',
          }}>🧬</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.01em' }}>Vexel Admin</div>
            <div style={{ fontSize: '10px', color: 'hsl(240,20%,55%)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Back Office</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const isParentActive = pathname === item.href || pathname.startsWith(item.href + '/')
            || (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false);
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  marginBottom: '1px',
                  color: isParentActive ? '#f8fafc' : 'hsl(240,15%,58%)',
                  background: isParentActive && !item.children
                    ? 'linear-gradient(90deg, hsl(249 76% 58% / 0.22) 0%, hsl(249 76% 58% / 0.08) 100%)'
                    : isParentActive ? 'hsl(249 76% 58% / 0.08)' : 'transparent',
                  textDecoration: 'none', fontSize: '13.5px',
                  fontWeight: isParentActive ? 600 : 400,
                  transition: 'all 0.12s',
                  borderLeft: isParentActive && !item.children ? '2px solid hsl(249,76%,68%)' : '2px solid transparent',
                }}
                onMouseOver={(e) => { if (!isParentActive) { (e.currentTarget as HTMLElement).style.background = 'hsl(240,20%,100%,0.06)'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; } }}
                onMouseOut={(e) => { if (!isParentActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(240,15%,58%)'; } }}
              >
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.children && <ChevronDown style={{ width: '12px', height: '12px', opacity: 0.5, transform: isParentActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
              </Link>
              {item.children && isParentActive && (
                <div style={{ marginBottom: '4px' }}>
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          display: 'block',
                          padding: '7px 12px 7px 38px',
                          borderRadius: '6px',
                          marginBottom: '1px',
                          color: childActive ? '#f8fafc' : 'hsl(240,12%,52%)',
                          background: childActive ? 'hsl(249 76% 58% / 0.18)' : 'transparent',
                          textDecoration: 'none', fontSize: '12.5px',
                          fontWeight: childActive ? 600 : 400,
                          transition: 'all 0.12s',
                          borderLeft: childActive ? '2px solid hsl(249,76%,68%)' : '2px solid transparent',
                        }}
                        onMouseOver={(e) => { if (!childActive) { (e.currentTarget as HTMLElement).style.background = 'hsl(240,20%,100%,0.05)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db'; } }}
                        onMouseOut={(e) => { if (!childActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(240,12%,52%)'; } }}
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

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '1px solid hsl(243,28%,18%)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '9px 12px',
            background: 'transparent',
            border: '1px solid hsl(243,25%,24%)',
            borderRadius: '8px',
            color: 'hsl(240,15%,55%)',
            cursor: 'pointer', fontSize: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            transition: 'all 0.15s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#f1f5f9'; e.currentTarget.style.borderColor = 'hsl(243,25%,35%)'; e.currentTarget.style.background = 'hsl(243,25%,18%)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'hsl(240,15%,55%)'; e.currentTarget.style.borderColor = 'hsl(243,25%,24%)'; e.currentTarget.style.background = 'transparent'; }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
