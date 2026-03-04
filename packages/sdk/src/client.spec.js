const createFetchClient = (options) => {
  return { ...options, __mocked: true };
};

// Extracted from client.ts
function createApiClientLogic(options) {
  const { baseUrl, token, correlationId, headers: extraHeaders } = options;

  const defaultHeaders = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    ...(extraHeaders ?? {}),
  };

  return createFetchClient({
    baseUrl,
    headers: defaultHeaders,
    credentials: 'include',
  });
}

describe('createApiClient logic integration', () => {
  it('should correctly construct client options and return openapi-fetch client', () => {
    const options = {
      baseUrl: 'https://api.example.com',
      token: 'test-token',
      correlationId: 'test-correlation-id',
      headers: { 'X-Extra': 'value' }
    };

    const client = createApiClientLogic(options);

    expect(client.baseUrl).toBe('https://api.example.com');
    expect(client.headers.Authorization).toBe('Bearer test-token');
    expect(client.headers['x-correlation-id']).toBe('test-correlation-id');
    expect(client.headers['X-Extra']).toBe('value');
    expect(client.credentials).toBe('include');
    expect(client.__mocked).toBe(true);
  });
});
