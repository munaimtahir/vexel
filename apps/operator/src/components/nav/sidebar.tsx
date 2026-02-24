'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, FlaskConical, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearTokens } from '@/lib/auth';
import { LIMS_NAV, FUTURE_MODULES, type NavItem } from './nav-config';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

const STORAGE_KEY = 'vexel-sidebar-collapsed';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { flags } = useFeatureFlags();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
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

  const visibleNav: NavItem[] = LIMS_NAV.filter(item => {
    if (!item.featureFlag) return true;
    return flags?.[item.featureFlag];
  });

  return (
    <aside
      className={cn(
        'flex flex-col flex-shrink-0 h-screen sticky top-0 sidebar-bg text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[228px]'
      )}
      style={{ borderRight: '1px solid hsl(243 28% 18%)' }}
    >
      {/* Logo header */}
      <div className={cn(
        'flex items-center border-b px-4 py-4 min-h-[64px]',
        collapsed ? 'justify-center' : 'justify-between',
        'border-sidebar-border'
      )}>
        {!collapsed && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              {/* Logo pill */}
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary shadow-md">
                <FlaskConical className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-white tracking-wide">Vexel</span>
                <span className="ml-1.5 text-[10px] font-medium text-indigo-300/70 uppercase tracking-widest">Health</span>
              </div>
            </div>
            {/* Module badges */}
            <div className="flex gap-1.5 pl-0.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold gradient-primary text-white shadow-xs">LIMS</span>
              {FUTURE_MODULES.map(m => (
                <span key={m.label} className="px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-500 bg-white/5 cursor-not-allowed">{m.label}</span>
              ))}
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-md">
            <FlaskConical className="h-4 w-4 text-white" />
          </div>
        )}
        <button
          onClick={toggle}
          className={cn(
            'p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors',
            collapsed && 'hidden'
          )}
          title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Collapsed toggle (shown when collapsed) */}
      {collapsed && (
        <button
          onClick={toggle}
          className="mx-auto mt-2 p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Expand sidebar (Ctrl+B)"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === '/lims/registrations/new'
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150',
                isActive
                  ? 'bg-white/12 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:bg-white/8 hover:text-slate-100',
                collapsed && 'justify-center px-2',
              )}
              style={isActive ? {
                background: 'linear-gradient(90deg, hsl(249 76% 58% / 0.25) 0%, hsl(249 76% 58% / 0.08) 100%)',
              } : undefined}
            >
              {/* Active left accent bar */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full"
                  style={{ background: 'hsl(249, 76%, 68%)' }}
                />
              )}
              <Icon className={cn(
                'h-4 w-4 flex-shrink-0 transition-colors',
                isActive ? 'text-indigo-300' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-2.5 w-full text-sm text-slate-400 hover:text-white transition-colors rounded-lg py-2 px-3 hover:bg-white/10',
            collapsed && 'justify-center px-2',
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
