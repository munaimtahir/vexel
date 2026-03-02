'use client';
import { usePathname } from 'next/navigation';
import { Header, BreadcrumbBar, type BreadcrumbItem } from '@vexel/ui-system';

function titleFromPath(pathname: string) {
  const clean = pathname.startsWith('/admin') ? pathname.replace('/admin', '') : pathname;
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return { title: 'Dashboard', crumbs: [{ label: 'Dashboard' }] };

  const crumbs: BreadcrumbItem[] = parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join('/')}`;
    const label = part
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { href, label };
  });

  return { title: crumbs[crumbs.length - 1]?.label ?? 'Admin', crumbs };
}

export function AdminHeader() {
  const pathname = usePathname();
  const { title, crumbs } = titleFromPath(pathname);

  return (
    <Header
      left={
        <div>
          <BreadcrumbBar items={crumbs} className="mb-1" />
          <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        </div>
      }
    />
  );
}
