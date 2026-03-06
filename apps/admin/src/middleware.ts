import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAdminLanding } from '@/lib/admin-access';

type JwtPayload = {
  exp?: number;
  permissions?: string[];
  isSuperAdmin?: boolean;
};

function parseJwtPayload(token: string | undefined): JwtPayload | null {
  if (!token) return null;
  try {
    const payloadBase64Url = token.split('.')[1];
    if (!payloadBase64Url) return null;
    const payloadBase64Unpadded = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (payloadBase64Unpadded.length % 4)) % 4;
    const payloadBase64 = payloadBase64Unpadded + '='.repeat(padLength);
    const payloadJson = atob(payloadBase64);
    return JSON.parse(payloadJson) as JwtPayload;
  } catch {
    return null;
  }
}

function isJwtValid(payload: JwtPayload | null): boolean {
  try {
    if (!payload || typeof payload.exp !== 'number') return false;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowSeconds;
  } catch {
    return false;
  }
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  const response = NextResponse.redirect(url);
  clearAuthCookies(response);
  return response;
}

function clearAuthCookies(response: NextResponse) {
  response.cookies.delete('vexel_token');
  response.cookies.delete('vexel_refresh');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('vexel_token')?.value;
  const payload = parseJwtPayload(token);
  const hasValidToken = isJwtValid(payload);
  const permissions = Array.isArray(payload?.permissions) ? payload.permissions : [];
  const isSuperAdmin = Boolean(payload?.isSuperAdmin);
  const landingPath = resolveAdminLanding(permissions, isSuperAdmin);

  // Public path — login page
  if (pathname === '/login') {
    // Already authenticated → skip login page, go to dashboard
    if (hasValidToken) {
      const url = request.nextUrl.clone();
      url.pathname = landingPath;
      return NextResponse.redirect(url);
    }
    if (token && !hasValidToken) {
      const response = NextResponse.next();
      clearAuthCookies(response);
      return response;
    }
    return NextResponse.next();
  }

  // Root path — redirect based on auth state
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = hasValidToken ? landingPath : '/login';
    return NextResponse.redirect(url);
  }

  // All other protected paths — require auth
  if (!hasValidToken) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  // Match all paths except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
