'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const MODULES = [
  {
    id: 'lims',
    label: 'Laboratory (LIMS)',
    description: 'Registrations, sample collection, results entry, verification, reports',
    icon: '🧪',
    enabled: true,
    href: '/lims/worklist',
  },
  {
    id: 'radiology',
    label: 'Radiology',
    description: 'Radiology orders, imaging, reports',
    icon: '🩻',
    enabled: false,
    href: null,
  },
  {
    id: 'opd',
    label: 'OPD / Clinic',
    description: 'Outpatient consultations, prescriptions, follow-up',
    icon: '🏥',
    enabled: false,
    href: null,
  },
];

export default function OperatorLandingPage() {
  const router = useRouter();

  // Auto-redirect to LIMS if it's the only enabled module
  useEffect(() => {
    const enabledModules = MODULES.filter((m) => m.enabled);
    if (enabledModules.length === 1 && enabledModules[0].href) {
      const timer = setTimeout(() => {
        router.replace(enabledModules[0].href!);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-8">
      {/* Brand */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-extrabold text-slate-100 mb-2">Vexel Operator</h1>
        <p className="text-slate-400 text-base">Select a module to continue</p>
      </div>

      {/* Module switcher cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 justify-center" style={{ gridTemplateColumns: 'repeat(3, 280px)' }}>
        {MODULES.map((mod) => (
          <div
            key={mod.id}
            onClick={() => mod.enabled && mod.href && router.push(mod.href)}
            className={cn(
              'rounded-2xl p-7 transition-all duration-150',
              mod.enabled
                ? 'bg-slate-800 border-2 border-primary cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-[hsl(var(--primary)/0.18)]'
                : 'bg-gray-900 border-2 border-gray-800 opacity-50 cursor-default'
            )}
          >
            <div className="text-4xl mb-4">{mod.icon}</div>
            <h2 className="text-lg font-bold text-slate-100 mb-2">{mod.label}</h2>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed">{mod.description}</p>
            {mod.enabled ? (
              <span className="inline-block px-4 py-1.5 bg-primary text-white rounded-md text-sm font-semibold">
                Open →
              </span>
            ) : (
              <span className="inline-block px-4 py-1.5 bg-gray-700 text-gray-400 rounded-md text-sm font-medium">
                Coming soon
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Redirect notice */}
      <p className="text-slate-500 text-sm mt-10">Redirecting to LIMS…</p>
    </div>
  );
}
