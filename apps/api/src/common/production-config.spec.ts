import { getJwtSecret, getStorageSecretKey, validateProductionConfig } from './production-config';

describe('production configuration validation', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('allows development defaults', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(getJwtSecret()).toBe('vexel-dev-secret-change-in-production');
    expect(() => validateProductionConfig()).not.toThrow();
  });

  it('rejects known default production secrets', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'vexel-dev-secret-REPLACE-IN-PRODUCTION';
    process.env.STORAGE_ACCESS_KEY = 'production-access-key';
    process.env.STORAGE_SECRET_KEY = 'production-storage-secret';
    process.env.CORS_ALLOWED_ORIGINS = 'https://example.test';
    expect(() => validateProductionConfig()).toThrow('JWT_SECRET');
  });

  it('requires a non-default storage secret in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_SECRET_KEY = 'vexel_secret_2026';
    expect(() => getStorageSecretKey()).toThrow('STORAGE_SECRET_KEY');
  });
});
