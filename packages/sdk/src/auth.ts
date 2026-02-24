/**
 * Shared Auth Utilities for Vexel Apps
 * Uses cookies for cross-app session sharing.
 */

export const TOKEN_KEY = 'vexel_token';
export const REFRESH_KEY = 'vexel_refresh';

/**
 * Persist tokens in cookies. 
 * If domain is provided (e.g. ".alshifalab.pk"), tokens are shared across subdomains.
 */
export function setTokens(accessToken: string, refreshToken: string, domain?: string) {
    if (typeof document === 'undefined') return;

    // Set expiration to 7 days for cookies to match refresh token TTL
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const common = `path=/; ${domain ? `domain=${domain};` : ''} expires=${expires.toUTCString()}; samesite=lax`;

    document.cookie = `${TOKEN_KEY}=${accessToken}; ${common}`;
    document.cookie = `${REFRESH_KEY}=${refreshToken}; ${common}`;

    // Also sync to localStorage for backwards compatibility or easy access in client
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
}

/**
 * Remove tokens from both cookies and localStorage.
 */
export function clearTokens(domain?: string) {
    if (typeof document === 'undefined') return;

    const common = `path=/; ${domain ? `domain=${domain};` : ''} expires=Thu, 01 Jan 1970 00:00:00 GMT`;

    document.cookie = `${TOKEN_KEY}=; ${common}`;
    document.cookie = `${REFRESH_KEY}=; ${common}`;

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
}

/**
 * Retrieve tokens from cookies (prioritized) or localStorage.
 */
export function getTokens(): { token: string | null; refresh: string | null } {
    if (typeof document === 'undefined') return { token: null, refresh: null };

    const cookies = document.cookie.split(';').reduce((acc, c) => {
        const eqIdx = c.indexOf('=');
        if (eqIdx === -1) return acc;
        const k = c.slice(0, eqIdx).trim();
        const v = c.slice(eqIdx + 1).trim();
        acc[k] = v;
        return acc;
    }, {} as Record<string, string>);

    const token = cookies[TOKEN_KEY] || localStorage.getItem(TOKEN_KEY);
    const refresh = cookies[REFRESH_KEY] || localStorage.getItem(REFRESH_KEY);

    return { token: token || null, refresh: refresh || null };
}

export function getToken(): string | null {
    return getTokens().token;
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

/**
 * Basic JWT decoder for client-side permission checks.
 */
export function decodeJwt(token: string | null): any {
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}
