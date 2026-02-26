'use client';

import Link from 'next/link';

const cards = [
  {
    title: 'Providers',
    href: '/opd/providers',
    description: 'Manage OPD provider master data (code, specialty, fee, active state).',
  },
  {
    title: 'Schedules',
    href: '/opd/schedules',
    description: 'Configure provider weekly schedules and slot settings (admin config only).',
  },
  {
    title: 'Feature Flags',
    href: '/feature-flags',
    description: 'Enable or disable OPD and LIMS module feature flags. Tenant-scoped.',
  },
];

export default function OpdAdminHomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">OPD Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Admin configuration only. No appointment, visit, or invoice workflow status actions are exposed here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-border hover:shadow"
          >
            <div className="text-sm font-semibold text-slate-900">{card.title}</div>
            <p className="mt-2 text-sm leading-5 text-slate-600">{card.description}</p>
            <div className="mt-4 text-sm font-medium text-primary group-hover:text-primary">
              Open
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
