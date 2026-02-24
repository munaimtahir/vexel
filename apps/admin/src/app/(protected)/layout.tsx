'use client';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/sidebar';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{
          flex: 1,
          overflow: 'auto',
          background: 'linear-gradient(160deg, hsl(240,8%,97%) 0%, hsl(249,10%,95%) 100%)',
          minHeight: '100vh',
        }}>
          <div style={{ padding: '32px', maxWidth: '1400px' }}>
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
