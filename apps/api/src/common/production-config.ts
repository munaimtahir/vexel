const UNSAFE_DEFAULTS = new Set([
  'vexel-dev-secret-change-in-production',
  'vexel-dev-secret-REPLACE-IN-PRODUCTION',
  'vexel_secret_2026',
  'REPLACE_WITH_64_BYTE_HEX_SECRET',
]);

function requireProductionSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || UNSAFE_DEFAULTS.has(value)) {
    throw new Error(`${name} must be set to a non-default secret in production`);
  }
  return value;
}

export function getJwtSecret(): string {
  if (process.env.NODE_ENV === 'production') return requireProductionSecret('JWT_SECRET');
  return process.env.JWT_SECRET?.trim() || 'vexel-dev-secret-change-in-production';
}

export function getStorageAccessKey(): string {
  if (process.env.NODE_ENV === 'production') return requireProductionSecret('STORAGE_ACCESS_KEY');
  return process.env.STORAGE_ACCESS_KEY?.trim() || 'vexel';
}

export function getStorageSecretKey(): string {
  if (process.env.NODE_ENV === 'production') return requireProductionSecret('STORAGE_SECRET_KEY');
  return process.env.STORAGE_SECRET_KEY?.trim() || 'vexel_secret_2026';
}

/** Fail before opening listeners or accepting traffic. */
export function validateProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;
  getJwtSecret();
  getStorageAccessKey();
  getStorageSecretKey();

  const origins = process.env.CORS_ALLOWED_ORIGINS?.trim();
  if (!origins) throw new Error('CORS_ALLOWED_ORIGINS must be configured in production');
}
