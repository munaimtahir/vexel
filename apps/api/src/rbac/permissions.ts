export enum Permission {
  // Super admin
  ADMIN_SUPER = 'admin.super',

  // Tenant management
  TENANT_READ = 'tenant.read',
  TENANT_CREATE = 'tenant.create',
  TENANT_UPDATE = 'tenant.update',

  // User management
  USER_READ = 'user.read',
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DISABLE = 'user.disable',

  // Role management
  ROLE_READ = 'role.read',
  ROLE_CREATE = 'role.create',
  ROLE_UPDATE = 'role.update',
  ROLE_DELETE = 'role.delete',
  ROLE_ASSIGN = 'role.assign',

  // Feature flags
  FEATURE_FLAG_READ = 'feature_flag.read',
  FEATURE_FLAG_SET = 'feature_flag.set',

  // Catalog
  CATALOG_READ = 'catalog.read',
  CATALOG_WRITE = 'catalog.write',
  CATALOG_MANAGE = 'catalog.manage',

  // Audit
  AUDIT_READ = 'audit.read',

  // Jobs
  JOB_READ = 'job.read',
  JOB_RETRY = 'job.retry',

  // Branding
  BRANDING_READ = 'branding.read',
  BRANDING_WRITE = 'branding.write',

  // LIMS — Patients & Encounters
  PATIENT_MANAGE = 'patient.manage',
  ENCOUNTER_MANAGE = 'encounter.manage',
  RESULT_ENTER = 'result.enter',
  RESULT_VERIFY = 'result.verify',

  // Documents
  DOCUMENT_GENERATE = 'document.generate',
  DOCUMENT_PUBLISH = 'document.publish',
}

export const ALL_PERMISSIONS = Object.values(Permission);
