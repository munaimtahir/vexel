import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isJwtValid(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payloadBase64Url = token.split('.')[1];
    if (!payloadBase64Url) return false;
    const payloadBase64Unpadded = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (payloadBase64Unpadded.length % 4)) % 4;
    const payloadBase64 = payloadBase64Unpadded + '='.repeat(padLength);
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
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
  const hasValidToken = isJwtValid(token);

  if (pathname === '/login') {
    if (hasValidToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
    if (token && !hasValidToken) {
      const response = NextResponse.next();
      clearAuthCookies(response);
      return response;
    }
    return NextResponse.next();
  }

  if (!hasValidToken) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
