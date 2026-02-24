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
  { key: 'opd.providers', enabled: false, description: 'OPD provider setup and directory' },
  { key: 'opd.scheduling', enabled: false, description: 'OPD provider schedule management' },
  { key: 'opd.appointments', enabled: false, description: 'OPD appointment booking workflow' },
  { key: 'opd.vitals', enabled: false, description: 'OPD vitals capture workflow' },
  { key: 'opd.clinical_note', enabled: false, description: 'OPD structured clinical notes' },
  { key: 'opd.prescription_free_text', enabled: false, description: 'OPD free-text prescription workflow' },
  { key: 'opd.billing', enabled: false, description: 'OPD billing and payments' },
  { key: 'opd.invoice_receipt_pdf', enabled: false, description: 'OPD deterministic invoice/receipt PDFs' },
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

  // ── Demo roles ─────────────────────────────────────────────────────────────
  const operatorRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'operator' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'operator',
      description: 'Lab operator: registration, sample collection, result entry',
      rolePermissions: {
        create: [
          'catalog.read', 'patient.manage', 'encounter.manage',
          'result.enter', 'document.generate',
        ].map((p) => ({ permission: p })),
      },
    },
  });

  const verifierRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'verifier' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'verifier',
      description: 'Pathologist/verifier: verify results and publish reports',
      rolePermissions: {
        create: [
          'catalog.read', 'encounter.manage', 'result.enter',
          'result.verify', 'document.generate', 'document.publish',
        ].map((p) => ({ permission: p })),
      },
    },
  });
  const opdOperatorRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'opd-operator' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'opd-operator',
      description: 'OPD front desk/operator: appointments, check-in, visit intake',
      rolePermissions: {
        create: [
          'patient.manage',
          'encounter.manage',
          'opd.provider.read',
          'opd.schedule.read',
          'opd.appointment.manage',
          'opd.visit.manage',
          'opd.vitals.write',
          'document.generate',
        ].map((p) => ({ permission: p })),
      },
    },
  });

  const opdDoctorRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'opd-doctor' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'opd-doctor',
      description: 'OPD doctor: consultation, notes, prescription',
      rolePermissions: {
        create: [
          'patient.manage',
          'encounter.manage',
          'opd.provider.read',
          'opd.appointment.read',
          'opd.visit.manage',
          'opd.vitals.read',
          'opd.clinical_note.write',
          'opd.prescription.write',
          'document.generate',
        ].map((p) => ({ permission: p })),
      },
    },
  });

  const opdFinanceRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: 'system', name: 'opd-finance' } },
    update: {},
    create: {
      tenantId: 'system',
      name: 'opd-finance',
      description: 'OPD finance/cash desk: invoices, payments, receipts',
      rolePermissions: {
        create: [
          'patient.manage',
          'encounter.manage',
          'opd.invoice.manage',
          'opd.payment.manage',
          'document.generate',
          'document.publish',
        ].map((p) => ({ permission: p })),
      },
    },
  });
  console.log('✅ Demo roles: operator, verifier, opd-operator, opd-doctor, opd-finance');

  // ── Demo users ─────────────────────────────────────────────────────────────
  const demoUsers = [
    { email: 'operator@demo.vexel.pk', firstName: 'Demo', lastName: 'Operator', password: 'Operator@demo123!', roleId: operatorRole.id },
    { email: 'verifier@demo.vexel.pk', firstName: 'Demo', lastName: 'Verifier', password: 'Verifier@demo123!', roleId: verifierRole.id },
  ];

  for (const u of demoUsers) {
    const hash = await bcrypt.hash(u.password, 12);
    const created = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: 'system', email: u.email } },
      update: {},
      create: { tenantId: 'system', email: u.email, firstName: u.firstName, lastName: u.lastName, passwordHash: hash },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: u.roleId } },
      update: {},
      create: { userId: created.id, roleId: u.roleId, grantedBy: superAdmin.id },
    });
    console.log(`✅ Demo user: ${u.email}  password: ${u.password}`);
  }

  // Seed minimal catalog tests for E2E testing
  await prisma.catalogTest.upsert({
    where: { tenant_test_externalId: { tenantId: 'system', externalId: 't1' } },
    update: {},
    create: { tenantId: 'system', externalId: 't1', name: 'Glucose', isActive: true },
  });
  await prisma.catalogTest.upsert({
    where: { tenant_test_externalId: { tenantId: 'system', externalId: 't2' } },
    update: {},
    create: { tenantId: 'system', externalId: 't2', name: 'Complete Blood Count', isActive: true },
  });
  console.log('✅ Catalog tests seeded (t1=Glucose, t2=CBC)');

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

  await prisma.documentTemplate.upsert({
    where: {
      tenantId_type_version: {
        tenantId: systemTenant.id,
        type: 'OPD_INVOICE_RECEIPT',
        version: 1,
      },
    },
    create: {
      tenantId: systemTenant.id,
      type: 'OPD_INVOICE_RECEIPT',
      templateKey: 'opd_invoice_receipt_v1',
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
