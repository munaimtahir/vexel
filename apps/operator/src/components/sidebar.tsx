'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearTokens } from '@/lib/auth';

const NAV_ITEMS = [
  { label: 'Encounters', href: '/encounters', icon: '🏥' },
  { label: 'Patients', href: '/patients', icon: '👤' },
];

export default function Sidebar({ currentPath }: { currentPath: string }) {
  const router = useRouter();

  const handleLogout = () => {
    clearTokens();
    router.push('/login');
  };

  return (
    <aside style={{ width: '220px', background: '#1e293b', color: 'white', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #334155' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>Vexel Operator</h1>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0' }}>LIMS Workflow</p>
      </div>
      <nav style={{ flex: 1, padding: '16px 0' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath.startsWith(item.href);
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 20px',
                  color: isActive ? '#f1f5f9' : '#94a3b8',
                  background: isActive ? '#334155' : 'transparent',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
              {item.href === '/patients' && (
                <Link
                  href="/patients/new"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 20px 8px 44px',
                    color: currentPath === '/patients/new' ? '#f1f5f9' : '#64748b',
                    background: currentPath === '/patients/new' ? '#334155' : 'transparent',
                    textDecoration: 'none',
                    fontSize: '13px',
                  }}
                >
                  + New Patient
                </Link>
              )}
            </div>
          );
        })}
      </nav>
      <div style={{ padding: '0 20px' }}>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '8px 0', background: 'transparent', border: '1px solid #475569', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '14px' }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
