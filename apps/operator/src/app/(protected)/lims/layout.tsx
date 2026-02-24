import { AppShell } from '@/components/shell/app-shell';

export default function LimsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
