'use client';
import { useState, useEffect } from 'react';
import { getToken, isAuthenticated } from './auth';
import { getApiClient } from './api-client';

export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { setLoading(false); return; }
    const api = getApiClient(getToken() ?? undefined);
    api.GET('/me').then(({ data }) => {
      setUser(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return { user, loading };
}
