import { createHmac, timingSafeEqual } from 'crypto';
import type { ImpersonationCookiePayload } from './impersonation.types';

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function signImpersonationPayload(payload: ImpersonationCookiePayload, secret: string): string {
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = toBase64Url(createHmac('sha256', secret).update(encoded).digest());
  return `${encoded}.${sig}`;
}

export function verifyImpersonationPayload(token: string, secret: string): ImpersonationCookiePayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, actualSig] = parts;
  const expectedSig = toBase64Url(createHmac('sha256', secret).update(encoded).digest());

  const actualBuf = Buffer.from(actualSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(actualBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as ImpersonationCookiePayload;
    if (!parsed?.session_id || !parsed?.impersonated_user_id || !parsed?.exp || parsed.mode !== 'READ_ONLY') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
