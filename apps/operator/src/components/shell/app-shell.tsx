import { LayoutShell } from '@vexel/ui-system';
import { Sidebar } from '@/components/nav/sidebar';
import { Topbar } from '@/components/nav/topbar';

export function AppShell({ children }: { children: React.ReactNode }) {
  return <LayoutShell sidebar={<Sidebar />} header={<Topbar />}>{children}</LayoutShell>;
}
