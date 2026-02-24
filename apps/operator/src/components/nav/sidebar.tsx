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

  // Hydrate from localStorage after mount
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

  // Ctrl+B keyboard shortcut
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
    <aside className={cn(
      'flex flex-col flex-shrink-0 h-screen sticky top-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200',
      collapsed ? 'w-[60px]' : 'w-[220px]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border min-h-[60px]">
        {!collapsed && (
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-blue-400" />
              <span className="text-sm font-bold text-white">Vexel</span>
            </div>
            <div className="flex gap-1 mt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">LIMS</span>
              {FUTURE_MODULES.map(m => (
                <span key={m.label} className="px-2 py-0.5 rounded text-[10px] text-slate-500 bg-slate-800 cursor-not-allowed">{m.label}</span>
              ))}
            </div>
          </div>
        )}
        {collapsed && <FlaskConical className="h-5 w-5 text-blue-400 mx-auto" />}
        <button
          onClick={toggle}
          className="ml-auto p-1 rounded hover:bg-sidebar-accent text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
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
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-white font-semibold'
                  : 'text-slate-400 hover:bg-sidebar-accent hover:text-white',
                collapsed && 'justify-center px-2',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-2 w-full text-sm text-slate-400 hover:text-white transition-colors rounded-md py-2 px-2 hover:bg-sidebar-accent',
            collapsed && 'justify-center',
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
