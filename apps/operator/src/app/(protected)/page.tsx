import { redirect } from 'next/navigation';

// Root landing — redirect to LIMS worklist (AppShell lives in lims/layout.tsx)
export default function RootPage() {
  redirect('/lims/worklist');
}
