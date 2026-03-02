'use client';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/sidebar';
import { AdminHeader } from '@/components/admin-header';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { LayoutShell } from '@vexel/ui-system';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ImpersonationBanner />
      <LayoutShell
        sidebar={<Sidebar />}
        header={<AdminHeader />}
      >
        {children}
      </LayoutShell>
    </AuthGuard>
  );
}
