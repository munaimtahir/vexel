export const IMPERSONATION_COOKIE_NAME = 'pgsims_impersonation';
export const IMPERSONATION_MODE = 'READ_ONLY' as const;
export const DEFAULT_IMPERSONATION_TTL_SECONDS = 2 * 60 * 60;
export const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const ADMIN_ROLE_NAMES = new Set([
  'admin',
  'utrmc_admin',
  'super-admin',
  'tenant-admin',
]);
