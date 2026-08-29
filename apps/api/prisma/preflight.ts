import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('🔍 Running OPD Preflight Database Audit...');
  try {
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
  } catch (err: any) {
    console.error('❌ Preflight Database Connection failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
