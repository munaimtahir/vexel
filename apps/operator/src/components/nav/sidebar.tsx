'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FlaskConical, LogOut } from 'lucide-react';
import { clearTokens, decodeJwt, getToken } from '@/lib/auth';
import { LIMS_NAV, FUTURE_MODULES, type NavItem } from './nav-config';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

const STORAGE_KEY = 'vexel-sidebar-collapsed';

const S = {
  headerBg:      'hsl(205,32%,28%)',
  bodyBg:        'hsl(205,30%,33%)',
  footerBg:      'hsl(205,32%,26%)',
  activeBg:      'rgba(196,138,94,0.17)',
  activeBar:     '#C48A5E',
  activeBarGlow: '0 0 10px rgba(196,138,94,0.65)',
  activeText:    '#F2EAD8',
  inactiveText:  '#7FABBE',
  hoverText:     '#D0DBE4',
  iconActive:    '#D4A882',
  iconInactive:  '#4A6E82',
  sectionLabel:  '#2C5268',
};

function GlowDivider() {
  return (
    <div style={{
      height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, rgba(196,138,94,0.55) 38%, rgba(135,175,196,0.35) 65%, transparent 100%)',
      flexShrink: 0,
    }} />
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName]   = useState('');
  const pathname = usePathname();
  const router   = useRouter();
  const { flags } = useFeatureFlags();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
    const token = getToken();
    if (token) {
      try {
        const p = decodeJwt(token) as Record<string, unknown>;
        setUserName(((p?.name as string) || (p?.email as string) || '').split('@')[0]);
      } catch { /* ignore */ }
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'b') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  const handleLogout = () => { clearTokens(); router.push('/login'); };

  const visibleNav: NavItem[] = LIMS_NAV.filter(item =>
    !item.featureFlag || flags?.[item.featureFlag]
  );

  const initials = userName
    ? userName.split(/[\s._-]/).map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)
    : 'OP';

  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '7px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.13)',
    color: S.iconInactive,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    flexShrink: 0,
  };

  return (
    <aside style={{
      width:    collapsed ? '64px' : '240px',
      minWidth: collapsed ? '64px' : '240px',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: S.bodyBg,
      borderRight: '1px solid rgba(196,138,94,0.28)',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1)',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      overflowX: 'hidden',
    }}>

      {/* HEADER */}
      <div style={{
        background: S.headerBg,
        position: 'relative',
        padding: collapsed ? '18px 0 16px' : '20px 14px 18px',
        display: 'flex', flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'flex-start',
        gap: '14px', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Warm spotlight from top-left — terracotta glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 25% -10%, rgba(196,138,94,0.25) 0%, transparent 60%)',
        }} />

        {/* Logo row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          width: '100%', position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{
              width: collapsed ? '38px' : '36px',
              height: collapsed ? '38px' : '36px',
              borderRadius: '10px', flexShrink: 0,
              background: 'linear-gradient(140deg, #D4956A 0%, #C07850 55%, #A86040 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(192,120,80,0.50), inset 0 1px 0 rgba(255,255,255,0.22)',
            }}>
              <FlaskConical style={{ width: '17px', height: '17px', color: '#FBF0E8' }} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#EDE6DA', letterSpacing: '-0.025em', lineHeight: 1 }}>
                  Vexel
                </div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#4A7A90', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: '3px' }}>
                  Health Platform
                </div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button onClick={toggle} style={{ ...iconBtn, width: '26px', height: '26px' }}
              onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = S.iconActive; el.style.borderColor = 'rgba(196,138,94,0.5)'; el.style.background = 'rgba(196,138,94,0.15)'; }}
              onMouseOut={e =>  { const el = e.currentTarget as HTMLElement; el.style.color = S.iconInactive; el.style.borderColor = 'rgba(255,255,255,0.13)'; el.style.background = 'rgba(255,255,255,0.07)'; }}
              title="Collapse sidebar (Ctrl+B)">
              <ChevronLeft style={{ width: '13px', height: '13px' }} />
            </button>
          )}
        </div>

        {/* Module pills */}
        {!collapsed && (
          <div style={{ display: 'flex', gap: '7px', position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 12px', borderRadius: '99px',
              background: 'rgba(196,138,94,0.22)',
              border: '1px solid rgba(196,138,94,0.52)',
              boxShadow: '0 0 12px rgba(196,138,94,0.18)',
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#D4A882', boxShadow: '0 0 5px rgba(212,168,130,0.9)' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#E8D4BE', letterSpacing: '0.07em' }}>LIMS</span>
            </div>
            {FUTURE_MODULES.map(m => (
              <div key={m.label} style={{
                padding: '5px 11px', borderRadius: '99px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'not-allowed',
              }}>
                <span style={{ fontSize: '10px', fontWeight: 500, color: '#3A6275', letterSpacing: '0.04em' }}>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <GlowDivider />

      {/* Expand button when collapsed */}
      {collapsed && (
        <button onClick={toggle} style={{ ...iconBtn, width: '32px', height: '32px', margin: '10px auto 6px' }}
          onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = S.iconActive; el.style.borderColor = 'rgba(196,138,94,0.5)'; el.style.background = 'rgba(196,138,94,0.15)'; }}
          onMouseOut={e =>  { const el = e.currentTarget as HTMLElement; el.style.color = S.iconInactive; el.style.borderColor = 'rgba(255,255,255,0.13)'; el.style.background = 'rgba(255,255,255,0.07)'; }}
          title="Expand sidebar (Ctrl+B)">
          <ChevronRight style={{ width: '13px', height: '13px' }} />
        </button>
      )}

      {/* NAVIGATION */}
      <nav style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: collapsed ? '10px 6px' : '10px 8px',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {!collapsed && (
          <div style={{ padding: '2px 8px 8px', fontSize: '9px', fontWeight: 700, color: S.sectionLabel, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Workspace
          </div>
        )}
        {visibleNav.map(item => {
          const Icon = item.icon;
          const isActive = item.href === '/lims/registrations/new'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: collapsed ? '10px 0' : '9px 11px 9px 13px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '8px', textDecoration: 'none',
                fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
                color: isActive ? S.activeText : S.inactiveText,
                background: isActive ? S.activeBg : 'transparent',
                transition: 'all 0.15s ease',
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}
              onMouseOver={e => { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.09)'; el.style.color = S.hoverText; } }}
              onMouseOut={e =>  { if (!isActive) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = S.inactiveText; } }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: '3px', height: '60%', minHeight: '18px',
                  borderRadius: '0 4px 4px 0',
                  background: S.activeBar,
                  boxShadow: S.activeBarGlow,
                }} />
              )}
              <Icon style={{ width: '15px', height: '15px', flexShrink: 0, color: isActive ? S.iconActive : S.iconInactive, transition: 'color 0.15s' }} />
              {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              {!collapsed && isActive && (
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0, background: '#C48A5E', boxShadow: '0 0 6px rgba(196,138,94,0.85)' }} />
              )}
            </Link>
          );
        })}
      </nav>

      <GlowDivider />

      {/* FOOTER */}
      <div style={{
        background: S.footerBg,
        padding: collapsed ? '12px 8px' : '14px 12px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '8px', flexShrink: 0,
      }}>
        {collapsed ? (
          <button onClick={handleLogout} style={{ ...iconBtn, width: '36px', height: '36px' }}
            onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#E88888'; el.style.borderColor = 'rgba(232,136,136,0.3)'; el.style.background = 'rgba(232,136,136,0.10)'; }}
            onMouseOut={e =>  { const el = e.currentTarget as HTMLElement; el.style.color = S.iconInactive; el.style.borderColor = 'rgba(255,255,255,0.13)'; el.style.background = 'rgba(255,255,255,0.07)'; }}
            title="Sign Out">
            <LogOut style={{ width: '14px', height: '14px' }} />
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                background: 'linear-gradient(135deg, #D4956A 0%, #B86A40 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11.5px', fontWeight: 700, color: '#FBF0E8',
                boxShadow: '0 2px 10px rgba(192,120,80,0.50), inset 0 1px 0 rgba(255,255,255,0.22)',
                letterSpacing: '0.02em',
              }}>
                {initials}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#DEDAD0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize', lineHeight: 1.3 }}>
                  {userName || 'Operator'}
                </div>
                <div style={{ fontSize: '10px', color: '#3A6478', fontWeight: 500, marginTop: '2px', letterSpacing: '0.03em' }}>
                  LIMS Operator
                </div>
              </div>
            </div>
            <button onClick={handleLogout} style={{ ...iconBtn, width: '30px', height: '30px' }}
              onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#E88888'; el.style.borderColor = 'rgba(232,136,136,0.3)'; el.style.background = 'rgba(232,136,136,0.10)'; }}
              onMouseOut={e =>  { const el = e.currentTarget as HTMLElement; el.style.color = S.iconInactive; el.style.borderColor = 'rgba(255,255,255,0.13)'; el.style.background = 'rgba(255,255,255,0.07)'; }}
              title="Sign Out">
              <LogOut style={{ width: '13px', height: '13px' }} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
