'use client';
import { useState, useEffect } from 'react';
import { getToken, isAuthenticated, decodeJwt } from './auth';
import { getApiClient } from './api-client';

export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Decode JWT immediately (synchronous) so RBAC works without waiting for /me
    const jwtData = decodeJwt(getToken());
    if (jwtData) {
      setUser({
        userId: jwtData.sub,
        email: jwtData.email,
        tenantId: jwtData.tenantId,
        roles: jwtData.roles ?? [],
        permissions: jwtData.permissions ?? [],
        isSuperAdmin: jwtData.isSuperAdmin ?? false,
        firstName: null as string | null,
        lastName: null as string | null,
      });
      setLoading(false);
    }

    if (!isAuthenticated()) { setLoading(false); return; }
    const api = getApiClient(getToken() ?? undefined);
    // Enrich with firstName/lastName from /me
    api.GET('/me').then(({ data }) => {
      if (data) setUser(data);
    }).catch(() => { /* keep JWT-decoded user */ });
  }, []);

  return { user, loading };
}
