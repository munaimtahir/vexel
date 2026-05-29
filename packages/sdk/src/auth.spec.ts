import { decodeJwt, getToken, setTokens, clearTokens } from './auth';

describe('SDK Auth Utilities', () => {
  describe('decodeJwt', () => {
    it('should decode a valid JWT payload correctly', () => {
      const payload = { sub: 'user-123', email: 'test@example.com', role: 'admin' };
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
      const signature = 'mockSignature';
      const token = `${header}.${payloadBase64}.${signature}`;

      const decoded = decodeJwt(token);
      expect(decoded).toEqual(payload);
    });

    it('should return null for malformed or empty token', () => {
      expect(decodeJwt(null)).toBeNull();
      expect(decodeJwt('')).toBeNull();
      expect(decodeJwt('not.a-valid.jwt')).toBeNull();
    });
  });

  describe('getToken in non-browser env', () => {
    it('should return null when running in Node.js (document is undefined)', () => {
      expect(getToken()).toBeNull();
    });
  });
});
