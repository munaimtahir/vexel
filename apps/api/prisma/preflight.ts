import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('🔍 Running OPD Preflight Database Audit...');
  try {
    const legacyTables = ['appointments', 'opd_clinical_notes', 'opd_prescription_items', 'opd_prescriptions', 'opd_visits', 'opd_vitals', 'provider_schedules', 'providers'];
    const legacyCounts: Record<string, number> = {};
    for (const table of legacyTables) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM "${table}"`);
        legacyCounts[table] = Number(rows[0]?.count ?? 0);
      } catch (error: any) {
        if (error?.code === 'P2010' || error?.meta?.code === '42P01') legacyCounts[table] = 0;
        else throw error;
      }
    }
    const counts = {
      doctors: await (prisma as any).opdDoctor.count(),
      schedules: await (prisma as any).opdSchedule.count(),
      appointments: await (prisma as any).opdAppointment.count(),
      encounters: await (prisma as any).opdEncounter.count(),
      vitals: await (prisma as any).opdVital.count(),
      notes: await (prisma as any).opdNote.count(),
      prescriptions: await (prisma as any).opdEncounterPrescription.count(),
      prescriptionItems: await (prisma as any).opdPrescriptionItemKmvp.count(),
      commands: await (prisma as any).opdCommandLog.count(),
    };
    console.log('✅ OPD Canonical Table Row Counts:');
    console.table(counts);
    console.log('Legacy OPD row counts (must be zero before retirement):');
    console.table(legacyCounts);
    const remaining = Object.values(legacyCounts).reduce((sum, value) => sum + value, 0);
    if (remaining > 0) {
      throw new Error(`Legacy OPD retirement blocked: ${remaining} rows require export and reconciliation`);
    }
  } catch (err: any) {
    console.error('❌ Preflight Database Connection failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
