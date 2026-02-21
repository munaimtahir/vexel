import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SYSTEM_PERMISSIONS = [
  'admin.super',
  'tenant.read', 'tenant.create', 'tenant.update',
  'user.read', 'user.create', 'user.update', 'user.disable',
  'role.read', 'role.create', 'role.update', 'role.delete',
  'role.assign',
  'feature_flag.read', 'feature_flag.set',
  'catalog.read', 'catalog.write', 'catalog.manage',
  'audit.read',
  'job.read', 'job.retry',
  'branding.read', 'branding.write',
  'patient.manage', 'encounter.manage', 'result.enter', 'result.verify',
  'document.generate', 'document.publish',
];

const DEFAULT_FEATURE_FLAGS = [
  { key: 'module.lims', enabled: true, description: 'LIMS core module' },
  { key: 'module.printing', enabled: false, description: 'Printing module' },
  { key: 'module.rad', enabled: false, description: 'Radiology (RAD) scaffold' },
  { key: 'module.opd', enabled: false, description: 'OPD scaffold' },
  { key: 'module.ipd', enabled: false, description: 'IPD scaffold' },
  { key: 'lims.auto_verify', enabled: false, description: 'Auto-verify LIMS results' },
  { key: 'lims.print_results', enabled: false, description: 'Allow printing results from LIMS' },
];

export async function main() {
  console.log('🌱 Seeding database...');

  // Create system tenant
  const systemTenant = await prisma.tenant.upsert({
    where: { id: 'system' },
    update: {},
    create: {
      id: 'system',
      name: 'Vexel System',
      status: 'active',
      isSuperAdmin: true,
      domains: {
        create: [
          { domain: 'admin.localhost' },
          { domain: 'localhost' },
        ],
      },
    },
  });
  console.log('✅ System tenant:', systemTenant.id);

  // Seed feature flags for system tenant
  for (const flag of DEFAULT_FEATURE_FLAGS) {
    await prisma.tenantFeature.upsert({
      where: { tenantId_key: { tenantId: 'system', key: flag.key } },
      update: {},
      create: { tenantId: 'system', ...flag },
    });
  }
  console.log('✅ Feature flags seeded');

  // Create super-admin role in system tenant
  const superAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'super-admin' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'super-admin',
      description: 'Full platform access',
      isSystem: true,
      rolePermissions: {
        create: SYSTEM_PERMISSIONS.map(p => ({ permission: p })),
      },
    },
  });
  console.log('✅ super-admin role:', superAdminRole.id);

  // Create tenant-admin role
  const tenantAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'tenant-admin' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'tenant-admin',
      description: 'Tenant admin access',
      isSystem: true,
      rolePermissions: {
        create: [
          'user.read','user.create','user.update','user.disable',
          'role.read','role.assign',
          'feature_flag.read','feature_flag.set',
          'catalog.read','catalog.write',
          'audit.read',
          'job.read','job.retry',
          'branding.read','branding.write',
        ].map(p => ({ permission: p })),
      },
    },
  });
  console.log('✅ tenant-admin role:', tenantAdminRole.id);

  // Create super-admin user
  const passwordHash = await bcrypt.hash('Admin@vexel123!', 12);
  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: 'system', email: 'admin@vexel.system' } },
    update: {},
    create: {
      tenantId: 'system',
      email: 'admin@vexel.system',
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash,
      status: 'active',
      isSuperAdmin: true,
    },
  });

  // Assign super-admin role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

  console.log('✅ Super-admin user:', superAdmin.email);
  console.log('   Password: Admin@vexel123!');

  // Seed default DocumentTemplates for system tenant
  await prisma.documentTemplate.upsert({
    where: { tenantId_type_version: { tenantId: systemTenant.id, type: 'RECEIPT', version: 1 } },
    create: {
      tenantId: systemTenant.id,
      type: 'RECEIPT',
      templateKey: 'receipt_v1',
      version: 1,
      isActive: true,
    },
    update: {},
  });

  await prisma.documentTemplate.upsert({
    where: { tenantId_type_version: { tenantId: systemTenant.id, type: 'LAB_REPORT', version: 1 } },
    create: {
      tenantId: systemTenant.id,
      type: 'LAB_REPORT',
      templateKey: 'lab_report_v1',
      version: 1,
      isActive: true,
    },
    update: {},
  });
  console.log('✅ Default DocumentTemplates seeded');

  console.log('');
  console.log('🎉 Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
