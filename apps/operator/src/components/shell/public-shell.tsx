import { FlaskConical } from 'lucide-react';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col">
      <header className="p-6">
        <div className="flex items-center gap-2 text-slate-700">
          <FlaskConical className="h-6 w-6 text-blue-600" />
          <span className="font-bold text-lg">Vexel Health</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        {children}
      </main>
    </div>
  );
}
