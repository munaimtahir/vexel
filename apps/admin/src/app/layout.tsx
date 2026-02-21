import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vexel Admin',
  description: 'Vexel Health Platform — Admin Back Office',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f1f5f9' }}>
        {children}
      </body>
    </html>
  );
}
