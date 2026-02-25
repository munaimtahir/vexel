'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { getApiClient } from '@/lib/api-client';
import { setTokens } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const api = getApiClient();
      const { data, error: apiError } = await api.POST('/auth/login', { body: { email, password } });
      if (apiError || !data) { setError('Invalid email or password'); return; }
      setTokens(data.accessToken, data.refreshToken);
      router.push('/lims/worklist');
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col">
      <header className="p-6">
        <div className="flex items-center gap-2 text-foreground">
          <FlaskConical className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">Vexel Health</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm shadow-md">
          <CardHeader>
            <CardTitle>Operator Login</CardTitle>
            <CardDescription>Sign in to your operator account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
