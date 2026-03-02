import * as React from 'react';
import { cn } from './utils';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export function BreadcrumbBar({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('mb-3 text-xs text-muted-foreground', className)}>
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <a href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </a>
              ) : (
                <span className={cn(isLast && 'text-foreground')}>{item.label}</span>
              )}
              {!isLast ? <span>/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
