import { Job } from 'bullmq';
import { prisma } from './prisma';

const CHUNK_SIZE = 50;

export async function processCatalogImport(job: Job) {
  const { jobRunId, tenantId, payload } = job.data as {
    jobRunId: string;
    tenantId: string;
    payload: {
      tests?: Array<{ code: string; name: string; description?: string; sampleType?: string; turnaroundHours?: number }>;
      parameters?: Array<{ code: string; name: string; unit?: string; dataType?: string }>;
      panels?: Array<{ code: string; name: string; description?: string }>;
      mappings?: Array<{ testCode: string; parameterCode: string; ordering?: number }>;
    };
    correlationId: string;
  };

  // Mark running
  await prisma.jobRun.update({
    where: { id: jobRunId },
    data: { status: 'running', startedAt: new Date() },
  });

  const summary = { created: 0, updated: 0, skipped: 0, total: 0 };

  try {
    // Upsert tests in chunks
    const tests = payload.tests ?? [];
    for (let i = 0; i < tests.length; i += CHUNK_SIZE) {
      const chunk = tests.slice(i, i + CHUNK_SIZE);
      for (const t of chunk) {
        const existing = await prisma.catalogTest.findUnique({
          where: { tenantId_code: { tenantId, code: t.code } },
        });
        if (existing) {
          await prisma.catalogTest.update({ where: { id: existing.id }, data: { name: t.name, description: t.description, sampleType: t.sampleType, turnaroundHours: t.turnaroundHours } });
          summary.updated++;
        } else {
          await prisma.catalogTest.create({ data: { tenantId, ...t } });
          summary.created++;
        }
        summary.total++;
      }
    }

    // Upsert parameters in chunks
    const parameters = payload.parameters ?? [];
    for (let i = 0; i < parameters.length; i += CHUNK_SIZE) {
      const chunk = parameters.slice(i, i + CHUNK_SIZE);
      for (const p of chunk) {
        const existing = await prisma.parameter.findUnique({
          where: { tenantId_code: { tenantId, code: p.code } },
        });
        if (existing) {
          await prisma.parameter.update({ where: { id: existing.id }, data: { name: p.name, unit: p.unit, dataType: p.dataType } });
          summary.updated++;
        } else {
          await prisma.parameter.create({ data: { tenantId, ...p } });
          summary.created++;
        }
        summary.total++;
      }
    }

    // Upsert panels in chunks
    const panels = payload.panels ?? [];
    for (let i = 0; i < panels.length; i += CHUNK_SIZE) {
      const chunk = panels.slice(i, i + CHUNK_SIZE);
      for (const panel of chunk) {
        const existing = await prisma.catalogPanel.findUnique({
          where: { tenantId_code: { tenantId, code: panel.code } },
        });
        if (existing) {
          await prisma.catalogPanel.update({ where: { id: existing.id }, data: { name: panel.name, description: panel.description } });
          summary.updated++;
        } else {
          await prisma.catalogPanel.create({ data: { tenantId, ...panel } });
          summary.created++;
        }
        summary.total++;
      }
    }

    // Upsert test-parameter mappings
    const mappings = payload.mappings ?? [];
    for (const m of mappings) {
      const test = await prisma.catalogTest.findUnique({ where: { tenantId_code: { tenantId, code: m.testCode } } });
      const param = await prisma.parameter.findUnique({ where: { tenantId_code: { tenantId, code: m.parameterCode } } });
      if (!test || !param) { summary.skipped++; continue; }

      const existing = await prisma.testParameterMapping.findUnique({
        where: { tenantId_testId_parameterId: { tenantId, testId: test.id, parameterId: param.id } },
      });
      if (!existing) {
        await prisma.testParameterMapping.create({ data: { tenantId, testId: test.id, parameterId: param.id, ordering: m.ordering ?? 0 } });
        summary.created++;
      } else {
        summary.skipped++;
      }
      summary.total++;
    }

    // Mark completed
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: 'completed', finishedAt: new Date(), resultSummary: summary },
    });

    console.log(`[catalog-import] Job ${jobRunId} completed:`, summary);
  } catch (err: any) {
    await prisma.jobRun.update({
      where: { id: jobRunId },
      data: { status: 'failed', finishedAt: new Date(), errorSummary: err.message },
    });
    console.error(`[catalog-import] Job ${jobRunId} failed:`, err.message);
    throw err;
  }
}
