'use client';
import { usePathname } from 'next/navigation';
import { Moon, Sun, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { decodeJwt, getToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

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
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
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
      } catch { /* ignore */ }
    }
  }, []);

  const initials = userName ? getInitials(userName) : '?';

  return (
    <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b bg-card/90 backdrop-blur-sm px-6"
      style={{ boxShadow: 'var(--shadow-xs)', borderColor: 'hsl(var(--border))' }}
    >
      {/* Left: page title */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground leading-tight">{title}</h1>
          <p className="text-[11px] text-muted-foreground">{today}</p>
        </div>
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-1.5">
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

        {/* User avatar */}
        {userName && (
          <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
            <div className={cn(
              'h-7 w-7 rounded-full gradient-primary flex items-center justify-center text-[11px] font-bold text-white shadow-xs select-none'
            )}>
              {initials}
            </div>
            <span className="text-xs font-medium text-foreground capitalize hidden sm:block">{userName}</span>
          </div>
        )}
      </div>
    </header>
  );
}
