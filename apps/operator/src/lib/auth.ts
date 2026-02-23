/**
 * Auth utilities for Operator app.
 * Re-exports from shared SDK.
 */
import { getTokens, getToken, setTokens, clearTokens, isAuthenticated } from '@vexel/sdk';

export { getTokens, getToken, setTokens, clearTokens, isAuthenticated };

// App-specific domain logic (can be sourced from env in prod)
const SHARED_DOMAIN = process.env.NEXT_PUBLIC_AUTH_DOMAIN;

export function login(accessToken: string, refreshToken: string) {
  setTokens(accessToken, refreshToken, SHARED_DOMAIN);
}

export function logout() {
  clearTokens(SHARED_DOMAIN);
}
