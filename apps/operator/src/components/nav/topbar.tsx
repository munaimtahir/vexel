'use client';
import { usePathname } from 'next/navigation';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

// Map route prefixes to page titles
const ROUTE_TITLES: [string, string][] = [
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

export function Topbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
