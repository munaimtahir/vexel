import { FlaskConical } from 'lucide-react';

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col">
      <header className="p-6">
        <div className="flex items-center gap-2 text-foreground">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Vexel Health</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        {children}
      </main>
    </div>
  );
}
