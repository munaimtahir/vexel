const decodeJwtLogic = (token) => {
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
};

describe('auth utilities logic', () => {
  describe('decodeJwt', () => {
    it('should decode a valid JWT', () => {
      const payload = { sub: '123', name: 'John Doe' };
      const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const mockToken = `header.${base64Payload}.signature`;

      const decoded = decodeJwtLogic(mockToken);
      expect(decoded).toEqual(payload);
    });

    it('should return null for invalid JWT', () => {
      expect(decodeJwtLogic('invalid-token')).toBeNull();
      expect(decodeJwtLogic(null)).toBeNull();
    });
  });
});
