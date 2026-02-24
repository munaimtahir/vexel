'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FlaskConical, LogOut } from 'lucide-react';
import { clearTokens, decodeJwt, getToken } from '@/lib/auth';
import { LIMS_NAV, FUTURE_MODULES, type NavItem } from './nav-config';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

const STORAGE_KEY = 'vexel-sidebar-collapsed';

/** A 1px gradient rule that glows violet in the center */
function GlowDivider() {
  return (
    <div style={{
      height: '1px',
      background: 'linear-gradient(90deg, transparent 0%, rgba(108,90,255,0.55) 45%, rgba(148,128,255,0.35) 55%, transparent 100%)',
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
    ? userName.split(/[\s._-]/).map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : 'OP';

  /* ─── shared icon button style ─── */
  const iconBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '7px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#424E72',
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
      /* ─ Deep space background: near-black with indigo soul ─ */
      background: 'linear-gradient(180deg, #11102B 0%, #0C0B1F 45%, #08071A 100%)',
      borderRight: '1px solid rgba(108,90,255,0.20)',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s cubic-bezier(.4,0,.2,1)',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
      overflowX: 'hidden',
    }}>

      {/* ═══════════════════════════════════════════════════
          HEADER — Brand identity + module selector
      ════════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        padding: collapsed ? '18px 0 16px' : '20px 14px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: collapsed ? 'center' : 'flex-start',
        gap: '14px',
        overflow: 'hidden',
      }}>
        {/* Ambient spotlight from top-right */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 70% -10%, rgba(108,90,255,0.28) 0%, transparent 65%)',
        }} />

        {/* Logo row + collapse toggle */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          width: '100%', position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            {/* Icon mark */}
            <div style={{
              width: collapsed ? '38px' : '36px',
              height: collapsed ? '38px' : '36px',
              borderRadius: '11px', flexShrink: 0,
              background: 'linear-gradient(140deg, #7B6CF6 0%, #5B47E8 55%, #4435C8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(91,71,232,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
            }}>
              <FlaskConical style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>

            {!collapsed && (
              <div>
                <div style={{ fontSize: '15.5px', fontWeight: 800, color: '#EDE9FF', letterSpacing: '-0.025em', lineHeight: 1 }}>
                  Vexel
                </div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: '#3D4570', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: '3px' }}>
                  Health Platform
                </div>
              </div>
            )}
          </div>

          {/* Collapse button (expanded only) */}
          {!collapsed && (
            <button
              onClick={toggle}
              style={{ ...iconBtn, width: '26px', height: '26px' }}
              onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#9D8FFC'; el.style.borderColor = 'rgba(108,90,255,0.45)'; el.style.background = 'rgba(108,90,255,0.12)'; }}
              onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#424E72'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.background = 'rgba(255,255,255,0.04)'; }}
              title="Collapse sidebar (Ctrl+B)"
            >
              <ChevronLeft style={{ width: '13px', height: '13px' }} />
            </button>
          )}
        </div>

        {/* Module pills (expanded only) */}
        {!collapsed && (
          <div style={{ display: 'flex', gap: '6px', position: 'relative', zIndex: 1 }}>
            {/* Active: LIMS */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 11px', borderRadius: '99px',
              background: 'linear-gradient(135deg, rgba(108,90,255,0.32) 0%, rgba(80,64,224,0.18) 100%)',
              border: '1px solid rgba(123,108,246,0.45)',
              boxShadow: '0 0 14px rgba(108,90,255,0.18)',
            }}>
              {/* pulse dot */}
              <div style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: '#8B7CF6',
                boxShadow: '0 0 5px rgba(139,124,246,0.9)',
              }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#C5B8FF', letterSpacing: '0.07em' }}>LIMS</span>
            </div>
            {/* Disabled future modules */}
            {FUTURE_MODULES.map(m => (
              <div key={m.label} style={{
                padding: '5px 11px', borderRadius: '99px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                cursor: 'not-allowed',
              }}>
                <span style={{ fontSize: '10px', fontWeight: 500, color: '#2A3055', letterSpacing: '0.05em' }}>{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Glowing divider below header */}
      <GlowDivider />

      {/* Expand button (collapsed only) */}
      {collapsed && (
        <button
          onClick={toggle}
          style={{ ...iconBtn, width: '32px', height: '32px', margin: '10px auto 6px' }}
          onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#9D8FFC'; el.style.borderColor = 'rgba(108,90,255,0.45)'; el.style.background = 'rgba(108,90,255,0.12)'; }}
          onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#424E72'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.background = 'rgba(255,255,255,0.04)'; }}
          title="Expand sidebar (Ctrl+B)"
        >
          <ChevronRight style={{ width: '13px', height: '13px' }} />
        </button>
      )}

      {/* ═══════════════════════════════════════════════════
          NAVIGATION
      ════════════════════════════════════════════════════ */}
      <nav style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: collapsed ? '10px 6px' : '10px 8px',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {/* Section label */}
        {!collapsed && (
          <div style={{
            padding: '2px 8px 8px', fontSize: '9px', fontWeight: 700,
            color: '#252C4A', letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            Workspace
          </div>
        )}

        {visibleNav.map(item => {
          const Icon = item.icon;
          const isActive = item.href === '/lims/registrations/new'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '10px 0' : '9px 11px 9px 13px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '9px',
                textDecoration: 'none',
                fontSize: '13.5px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#F0EDFF' : '#5A6690',
                background: isActive
                  ? 'linear-gradient(90deg, rgba(108,90,255,0.24) 0%, rgba(108,90,255,0.06) 100%)'
                  : 'transparent',
                transition: 'all 0.15s ease',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
              onMouseOver={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'rgba(255,255,255,0.05)';
                  el.style.color = '#A8B0D4';
                }
              }}
              onMouseOut={e => {
                if (!isActive) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = 'transparent';
                  el.style.color = '#5A6690';
                }
              }}
            >
              {/* Active left glow bar */}
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: '3px', height: '65%',
                  borderRadius: '0 4px 4px 0',
                  background: 'linear-gradient(180deg, #9D8FFC 0%, #6B58F0 100%)',
                  boxShadow: '0 0 10px rgba(108,90,255,0.75)',
                }} />
              )}

              {/* Icon */}
              <Icon style={{
                width: '15px', height: '15px', flexShrink: 0,
                color: isActive ? '#9D8FFC' : '#374168',
                transition: 'color 0.15s',
              }} />

              {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}

              {/* Active indicator glow dot */}
              {!collapsed && isActive && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: 'radial-gradient(circle, #B0A0FF 0%, #7B6CF6 100%)',
                  boxShadow: '0 0 7px rgba(139,124,246,0.85)',
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Glowing divider above footer */}
      <GlowDivider />

      {/* ═══════════════════════════════════════════════════
          FOOTER — User profile + logout
      ════════════════════════════════════════════════════ */}
      <div style={{
        padding: collapsed ? '12px 8px' : '13px 12px',
        background: 'rgba(0,0,0,0.30)',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '8px',
        flexShrink: 0,
      }}>
        {collapsed ? (
          /* Collapsed: just logout icon */
          <button
            onClick={handleLogout}
            style={{ ...iconBtn, width: '36px', height: '36px' }}
            onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#F87171'; el.style.borderColor = 'rgba(248,113,113,0.3)'; el.style.background = 'rgba(248,113,113,0.08)'; }}
            onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#424E72'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.background = 'rgba(255,255,255,0.04)'; }}
            title="Sign Out"
          >
            <LogOut style={{ width: '14px', height: '14px' }} />
          </button>
        ) : (
          <>
            {/* User row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              {/* Avatar */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                background: 'linear-gradient(135deg, #7B6CF6 0%, #4F3FE0 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11.5px', fontWeight: 700, color: '#fff',
                boxShadow: '0 2px 10px rgba(91,71,232,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
                letterSpacing: '0.02em',
              }}>
                {initials}
              </div>
              {/* Name + designation */}
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  fontSize: '12.5px', fontWeight: 600, color: '#C8C0F0',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  textTransform: 'capitalize', lineHeight: 1.3,
                }}>
                  {userName || 'Operator'}
                </div>
                <div style={{ fontSize: '10px', color: '#2E3659', fontWeight: 500, marginTop: '2px', letterSpacing: '0.03em' }}>
                  LIMS Operator
                </div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              style={{ ...iconBtn, width: '30px', height: '30px' }}
              onMouseOver={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#F87171'; el.style.borderColor = 'rgba(248,113,113,0.3)'; el.style.background = 'rgba(248,113,113,0.08)'; }}
              onMouseOut={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#424E72'; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.background = 'rgba(255,255,255,0.04)'; }}
              title="Sign Out"
            >
              <LogOut style={{ width: '13px', height: '13px' }} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
