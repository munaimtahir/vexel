'use client';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { decodeJwt, getToken } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Header } from '@vexel/ui-system';

const ROUTE_TITLES: [string, string][] = [
  ['/opd/billing/invoices', 'OPD Invoice'],
  ['/opd/billing/new', 'New OPD Invoice'],
  ['/opd/billing', 'OPD Billing'],
  ['/opd/providers', 'Provider Availability'],
  ['/opd/appointments/new', 'New OPD Appointment'],
  ['/opd/appointments', 'OPD Appointment'],
  ['/opd/visits', 'OPD Visit'],
  ['/opd/worklist', 'OPD Worklist'],
  ['/opd', 'OPD'],
  ['/lims/worklist', 'Worklist'],
  ['/lims/registrations/new', 'New Registration'],
  ['/lims/payments', 'Payments'],
  ['/lims/sample-collection', 'Sample Collection'],
  ['/lims/results', 'Results'],
  ['/lims/verification', 'Verification'],
  ['/lims/patients/new', 'New Patient'],
  ['/lims/patients', 'Patients'],
  ['/lims/encounters/new', 'New Encounter'],
  ['/lims/encounters', 'Encounters'],
  ['/lims/reports', 'Reports'],
  ['/lims', 'LIMS'],
];

function getPageTitle(pathname: string): string {
  for (const [prefix, title] of ROUTE_TITLES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return title;
  }
  return 'Vexel Operator';
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getInitials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export function Topbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const title = getPageTitle(pathname);
  const [userName, setUserName] = useState<string>('');
  const today = getTodayLabel();

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const payload = decodeJwt(token) as Record<string, unknown>;
        const name = (payload?.name as string) || (payload?.email as string) || '';
        setUserName(name.split('@')[0]);
      } catch {
        // ignore malformed token payload
      }
    }
  }, []);

  const initials = userName ? getInitials(userName) : '?';

  return (
    <Header
      title={title}
      subtitle={today}
      right={
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {userName ? (
            <div className="ml-2 flex items-center gap-2 border-l border-border pl-2">
              <div className={cn('gradient-primary shadow-xs flex h-7 w-7 select-none items-center justify-center rounded-full text-[11px] font-bold text-white')}>
                {initials}
              </div>
              <span className="hidden text-xs font-medium capitalize text-foreground sm:block">{userName}</span>
            </div>
          ) : null}
        </>
      }
    />
  );
}
