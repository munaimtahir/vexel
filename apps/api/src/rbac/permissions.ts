export enum Permission {
  // Super admin
  ADMIN_SUPER = 'admin.super',

  // Account self-service
  ACCOUNT_PROFILE_READ_SELF = 'account.profile.read-self',
  ACCOUNT_PROFILE_UPDATE_SELF = 'account.profile.update-self',
  ACCOUNT_PASSWORD_CHANGE_SELF = 'account.password.change-self',
  ADMIN_APP_ACCESS = 'admin.app.access',

  // Admin section permissions (platform-level)
  ADMIN_DASHBOARD_READ = 'admin.dashboard.read',
  ADMIN_AUDIT_READ = 'admin.audit.read',
  ADMIN_JOBS_READ = 'admin.jobs.read',
  ADMIN_JOBS_RETRY = 'admin.jobs.retry',
  ADMIN_USERS_READ = 'admin.users.read',
  ADMIN_USERS_WRITE = 'admin.users.write',
  ADMIN_ROLES_READ = 'admin.roles.read',
  ADMIN_ROLES_WRITE = 'admin.roles.write',
  ADMIN_TENANTS_READ = 'admin.tenants.read',
  ADMIN_TENANTS_WRITE = 'admin.tenants.write',
  ADMIN_FEATURE_FLAGS_READ = 'admin.feature_flags.read',
  ADMIN_FEATURE_FLAGS_WRITE = 'admin.feature_flags.write',
  ADMIN_CATALOG_READ = 'admin.catalog.read',
  ADMIN_CATALOG_WRITE = 'admin.catalog.write',

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

  // Ops / Backup Management
  OPS_VIEW = 'ops.view',
  OPS_RUN_BACKUP = 'ops.run_backup',
  OPS_EXPORT_TENANT = 'ops.export_tenant',
  OPS_CONFIGURE_SCHEDULES = 'ops.configure_schedules',
  OPS_CONFIGURE_STORAGE = 'ops.configure_storage',
  OPS_RESTORE = 'ops.restore',

  // Module access
  MODULE_ADMIN = 'module.admin',
  MODULE_OPERATOR = 'module.operator',

  // Template Registry / Studio
  TEMPLATES_READ = 'templates.read',
  TEMPLATES_WRITE = 'templates.write',
  TEMPLATES_PROVISION = 'templates.provision',
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const SELF_SERVICE_PERMISSIONS: Permission[] = [
  Permission.ACCOUNT_PROFILE_READ_SELF,
  Permission.ACCOUNT_PROFILE_UPDATE_SELF,
  Permission.ACCOUNT_PASSWORD_CHANGE_SELF,
];
