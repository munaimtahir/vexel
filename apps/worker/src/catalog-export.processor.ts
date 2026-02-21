import { Job } from 'bullmq';
import { prisma } from './prisma';

export async function processCatalogExport(job: Job) {
  const { jobRunId, tenantId } = job.data as { jobRunId: string; tenantId: string; correlationId: string };

  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: { status: 'running', startedAt: new Date() },
  });

  try {
    const [tests, parameters, panels, testParamMappings, panelTestMappings] = await Promise.all([
      prisma.catalogTest.findMany({ where: { tenantId, isActive: true } }),
      prisma.parameter.findMany({ where: { tenantId, isActive: true } }),
      prisma.catalogPanel.findMany({ where: { tenantId, isActive: true } }),
      prisma.testParameterMapping.findMany({ where: { tenantId } }),
      prisma.panelTestMapping.findMany({ where: { tenantId } }),
    ]);

    const resultSummary = {
      total: tests.length + parameters.length + panels.length,
      tests: tests.length,
      parameters: parameters.length,
      panels: panels.length,
      testParamMappings: testParamMappings.length,
      panelTestMappings: panelTestMappings.length,
      exportedAt: new Date().toISOString(),
      data: { tests, parameters, panels, testParamMappings, panelTestMappings },
    };

    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: 'completed', finishedAt: new Date(), resultSummary },
    });

    console.log(`[catalog-export] Job ${jobRunId} completed: ${resultSummary.total} items exported`);
  } catch (err: any) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: 'failed', finishedAt: new Date(), errorSummary: err.message },
    });
    console.error(`[catalog-export] Job ${jobRunId} failed:`, err.message);
    throw err;
  }
}
