'use client';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/sidebar';
import { AdminHeader } from '@/components/admin-header';
import { LayoutShell } from '@vexel/ui-system';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <LayoutShell
        sidebar={<Sidebar />}
        header={<AdminHeader />}
      >
        {children}
      </LayoutShell>
    </AuthGuard>
  );
}
