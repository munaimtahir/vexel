'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/lib/auth';
import { ChevronDown } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard',    label: 'Dashboard',     icon: '��' },
  { href: '/tenants',      label: 'Tenants',        icon: '🏢' },
  { href: '/users',        label: 'Users & Roles',  icon: '👥',
    children: [
      { href: '/users', label: 'Users' },
      { href: '/roles', label: 'Roles' },
    ],
  },
  { href: '/feature-flags',label: 'Feature Flags',  icon: '🚩' },
  { href: '/branding',     label: 'Branding',       icon: '🎨' },
  { href: '/catalog',      label: 'Catalog',        icon: '🧪',
    children: [
      { href: '/catalog/tests',            label: 'Tests' },
      { href: '/catalog/parameters',       label: 'Parameters' },
      { href: '/catalog/panels',           label: 'Panels' },
      { href: '/catalog/reference-ranges', label: 'Reference Ranges' },
      { href: '/catalog/import-export',    label: 'Import / Export' },
    ],
  },
  { href: '/patients',     label: 'Patients',       icon: '🏥',
    children: [
      { href: '/patients',   label: 'Patients' },
      { href: '/encounters', label: 'Encounters' },
    ],
  },
  { href: '/documents',    label: 'Documents',      icon: '📄' },
  { href: '/audit',        label: 'Audit Log',      icon: '📋' },
  { href: '/jobs',         label: 'Jobs',           icon: '⚙️' },
  { href: '/system/health',label: 'System Health',  icon: '❤️' },
];

/* Morandi dusty slate-blue sidebar */
const S = {
  headerBg:  'hsl(205,32%,28%)',
  bodyBg:    'hsl(205,30%,33%)',
  footerBg:  'hsl(205,32%,26%)',
  textActive:'#F2EAD8',
  textInact: '#7FABBE',
  textHover: '#D0DBE4',
  iconInact: '#4A6E82',
};

function GlowLine() {
  return (
    <div style={{
      height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, rgba(196,138,94,0.55) 38%, rgba(135,175,196,0.35) 65%, transparent 100%)',
    }} />
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const handleLogout = () => { logout(); router.push('/login'); };

  return (
    <aside style={{
      width: '240px', minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      background: S.bodyBg,
      borderRight: '1px solid rgba(196,138,94,0.28)',
    }}>
      {/* HEADER */}
      <div style={{
        background: S.headerBg, position: 'relative',
        padding: '20px 14px 18px', overflow: 'hidden', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 25% -10%, rgba(196,138,94,0.25) 0%, transparent 60%)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', position: 'relative', zIndex: 1 }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(140deg, #D4956A 0%, #C07850 55%, #A86040 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
            boxShadow: '0 4px 14px rgba(192,120,80,0.50), inset 0 1px 0 rgba(255,255,255,0.22)',
          }}>🧬</div>
          <div>
            <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#EDE6DA', letterSpacing: '-0.025em', lineHeight: 1 }}>
              Vexel Admin
            </div>
            <div style={{ fontSize: '9px', fontWeight: 600, color: '#4A7A90', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: '3px' }}>
              Back Office
            </div>
          </div>
        </div>
      </div>

      <GlowLine />

      {/* NAV */}
      <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ padding: '2px 8px 8px', fontSize: '9px', fontWeight: 700, color: '#2C5268', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Administration
        </div>
        {NAV_ITEMS.map((item) => {
          const isParentActive = pathname === item.href || pathname.startsWith(item.href + '/')
            || (item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false);
          return (
            <div key={item.href}>
              <Link href={item.href} style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 11px 9px 13px', borderRadius: '8px',
                color: isParentActive ? S.textActive : S.textInact,
                background: isParentActive && !item.children ? 'rgba(196,138,94,0.17)' : 'transparent',
                textDecoration: 'none', fontSize: '13.5px',
                fontWeight: isParentActive ? 600 : 400,
                transition: 'all 0.15s',
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}
                onMouseOver={e => { if (!isParentActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.09)'; el.style.color = S.textHover; } }}
                onMouseOut={e =>  { if (!isParentActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = S.textInact; } }}
              >
                {isParentActive && !item.children && (
                  <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: '3px', height: '60%', minHeight: '18px',
                    borderRadius: '0 4px 4px 0', background: '#C48A5E',
                    boxShadow: '0 0 10px rgba(196,138,94,0.65)',
                  }} />
                )}
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.children && (
                  <ChevronDown style={{
                    width: '12px', height: '12px', color: S.iconInact, flexShrink: 0,
                    transform: isParentActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                  }} />
                )}
              </Link>
              {item.children && isParentActive && (
                <div style={{ marginBottom: '2px' }}>
                  {item.children.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                    return (
                      <Link key={child.href} href={child.href} style={{
                        position: 'relative',
                        display: 'block', padding: '7px 11px 7px 36px',
                        borderRadius: '7px', marginBottom: '1px',
                        color: childActive ? S.textActive : '#5A8298',
                        background: childActive ? 'rgba(196,138,94,0.15)' : 'transparent',
                        textDecoration: 'none', fontSize: '12.5px',
                        fontWeight: childActive ? 600 : 400,
                        transition: 'all 0.12s',
                        borderLeft: childActive ? '2px solid #C48A5E' : '2px solid transparent',
                      }}
                        onMouseOver={e => { if (!childActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.07)'; el.style.color = S.textHover; } }}
                        onMouseOut={e =>  { if (!childActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = '#5A8298'; } }}
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

      <GlowLine />

      {/* FOOTER */}
      <div style={{
        background: S.footerBg, padding: '12px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <button onClick={handleLogout} style={{
          width: '100%', padding: '9px 12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '8px', color: '#5A8298',
          cursor: 'pointer', fontSize: '13px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
          transition: 'all 0.15s',
        }}
          onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#E88888'; el.style.borderColor = 'rgba(232,136,136,0.3)'; el.style.background = 'rgba(232,136,136,0.08)'; }}
          onMouseOut={e =>  { const el = e.currentTarget as HTMLElement; el.style.color = '#5A8298'; el.style.borderColor = 'rgba(255,255,255,0.10)'; el.style.background = 'rgba(255,255,255,0.04)'; }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
