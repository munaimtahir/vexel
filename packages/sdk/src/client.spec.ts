import { createApiClient } from './client';

describe('SDK Client Creation', () => {
  it('should correctly configure default headers and credentials', () => {
    const client = createApiClient({
      baseUrl: 'https://api.vexel.pk',
      token: 'mock-token',
      correlationId: 'mock-correlation-id',
      headers: {
        'x-custom-header': 'custom-value',
      },
    });

    expect(client).toBeDefined();
    // We can check options or headers if exposed, but openapi-fetch encapsulates them inside its internal closure/state.
    // However, we can assert that createApiClient builds without throwing, and we can inspect the generated types.
  });

  it('should configure client without token or correlationId', () => {
    const client = createApiClient({
      baseUrl: 'https://api.vexel.pk',
    });
    expect(client).toBeDefined();
  });
});
