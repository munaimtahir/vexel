import * as React from 'react';
import { cn } from './utils';
import { layoutTokens } from './tokens';

export function LayoutShell({
  sidebar,
  header,
  children,
  contentClassName,
  contentMaxWidth = layoutTokens.contentMaxWidth,
}: {
  sidebar: React.ReactNode;
  header: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  contentMaxWidth?: string;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header}
        <main className="page-canvas flex-1 overflow-y-auto">
          <div className={cn('mx-auto w-full p-6', contentClassName)} style={{ maxWidth: contentMaxWidth }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
