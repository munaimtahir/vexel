export type CurrentAdminUser = {
  isSuperAdmin?: boolean;
  permissions?: string[];
} | null | undefined;

export function hasAnyPermission(user: CurrentAdminUser, requiredPermissions?: string[]) {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (user?.isSuperAdmin) return true;

  const granted = new Set(user?.permissions ?? []);
  return requiredPermissions.some((perm) => granted.has(perm));
}

export function hasAllPermissions(user: CurrentAdminUser, requiredPermissions?: string[]) {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (user?.isSuperAdmin) return true;

  const granted = new Set(user?.permissions ?? []);
  return requiredPermissions.every((perm) => granted.has(perm));
}

