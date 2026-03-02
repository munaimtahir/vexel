import * as React from 'react';
import { cn } from './utils';
import { layoutTokens } from './tokens';

export function Sidebar({
  collapsed,
  children,
  className,
}: {
  collapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const width = collapsed ? layoutTokens.sidebarCollapsedWidth : layoutTokens.sidebarExpandedWidth;

  return (
    <aside
      className={cn('h-screen flex-shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar', className)}
      style={{ width, minWidth: width }}
    >
      {children}
    </aside>
  );
}
