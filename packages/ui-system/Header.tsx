import * as React from 'react';
import { cn } from './utils';
import { layoutTokens } from './tokens';

export function Header({
  title,
  subtitle,
  left,
  right,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center justify-between border-b bg-card/95 px-6 backdrop-blur',
        className,
      )}
      style={{ height: layoutTokens.headerHeight }}
    >
      <div className="min-w-0">
        {left ?? (
          <div>
            {title ? <h1 className="truncate text-sm font-semibold text-foreground">{title}</h1> : null}
            {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        )}
      </div>
      {right ? <div className="ml-3 flex items-center gap-2">{right}</div> : null}
    </header>
  );
}
