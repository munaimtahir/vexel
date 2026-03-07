'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiClient } from '@/lib/api-client';
import { setTokens, decodeJwt } from '@/lib/auth';
import { resolveAdminLanding } from '@/lib/admin-access';

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
      const { data, error: apiError } = await api.POST('/auth/login', {
        body: { email, password },
      });

      if (apiError || !data) {
        setError('Invalid credentials');
        return;
      }

      setTokens(data.accessToken, data.refreshToken);
      // Decode the JWT to determine landing page based on role/permissions.
      // This is safe client-side — the JWT is already in the browser after login.
      const jwtPayload = decodeJwt(data.accessToken);
      const permissions: string[] = Array.isArray(jwtPayload?.permissions) ? jwtPayload.permissions : [];
      const isSuperAdmin: boolean = Boolean(jwtPayload?.isSuperAdmin);
      const landingPath = resolveAdminLanding(permissions, isSuperAdmin);
      router.replace(landingPath);
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'hsl(var(--muted))',
    }}>
      <div style={{
        background: 'hsl(var(--card))',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-sm)',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: 'hsl(var(--foreground))' }}>
          Vexel Admin
        </h1>
        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '32px' }}>Sign in to your admin account</p>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="email" style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="password" style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {error && (
            <p style={{ color: 'hsl(var(--status-destructive-fg))', marginBottom: '16px', fontSize: '14px' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
