'use client';

import { useEffect, useState } from 'react';
import { getApiClient } from '@/lib/api-client';
import { getToken } from '@/lib/auth';

export type CurrentUser = {
  userId: string;
  email: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  firstName: string | null;
  lastName: string | null;
};

let userCache: CurrentUser | null = null;
let userCacheTime = 0;
let inFlight: Promise<CurrentUser | null> | null = null;
const CACHE_TTL_MS = 15_000;

function hasFreshCache() {
  return userCache && Date.now() - userCacheTime < CACHE_TTL_MS;
}

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const api = getApiClient(token);
    const { data, error, response } = await (api.GET as any)('/me');
    if (error || !response?.ok || !data) return null;

    userCache = data as CurrentUser;
    userCacheTime = Date.now();
    return userCache;
  } catch {
    return null;
  }
}

function getCurrentUserCached(): Promise<CurrentUser | null> {
  if (hasFreshCache()) return Promise.resolve(userCache);
  if (!inFlight) {
    inFlight = fetchCurrentUser().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function invalidateCurrentUserCache() {
  userCache = null;
  userCacheTime = 0;
  inFlight = null;
}

export function useCurrentUser(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(hasFreshCache() ? userCache : null);
  const [loading, setLoading] = useState(!hasFreshCache());

  useEffect(() => {
    let active = true;
    getCurrentUserCached().then((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { user, loading };
}
