import Link from 'next/link';

export default function CatalogPage() {
  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Catalog</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>Manage lab tests, parameters, panels, and bulk import/export.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '640px' }}>
        {[
          { href: '/catalog/tests', label: 'Tests', icon: '🧬', desc: 'Lab test catalog' },
          { href: '/catalog/parameters', label: 'Parameters', icon: '📐', desc: 'Result parameters' },
          { href: '/catalog/panels', label: 'Panels', icon: '📋', desc: 'Test panels / profiles' },
          { href: '/catalog/import-export', label: 'Import / Export', icon: '⬆️', desc: 'Bulk import & export jobs' },
        ].map((item) => (
          <Link key={item.href} href={item.href} style={{ display: 'block', padding: '20px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', textDecoration: 'none', color: 'inherit', border: '1px solid #f1f5f9', transition: 'box-shadow 0.15s' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{item.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>{item.label}</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>{item.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
