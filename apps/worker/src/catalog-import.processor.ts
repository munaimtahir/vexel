import { Job } from 'bullmq';
import { prisma } from './prisma';

const CHUNK_SIZE = 50;

export async function processCatalogImport(job: Job) {
  const { jobRunId, tenantId, payload } = job.data as {
    jobRunId: string;
    tenantId: string;
    payload: {
      tests?: Array<{
        externalId: string; name: string; description?: string; sampleType?: string; specimenType?: string;
        turnaroundHours?: number; price?: number; userCode?: string; loincCode?: string; department?: string; method?: string; isActive?: boolean;
      }>;
      parameters?: Array<{
        externalId: string; name: string; unit?: string; dataType?: string; userCode?: string; loincCode?: string; resultType?: string;
        defaultUnit?: string; decimals?: number; allowedValues?: string; defaultValue?: string; isActive?: boolean;
      }>;
      panels?: Array<{ externalId: string; name: string; description?: string; userCode?: string; loincCode?: string; price?: number; isActive?: boolean }>;
      mappings?: Array<{ testExternalId: string; parameterExternalId: string; ordering?: number; displayOrder?: number; isRequired?: boolean; unitOverride?: string }>;
      panelMappings?: Array<{ panelExternalId: string; testExternalId: string; ordering?: number; displayOrder?: number }>;
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
          where: { tenant_test_externalId: { tenantId, externalId: t.externalId } },
        });
        if (existing) {
          await prisma.catalogTest.update({
            where: { id: existing.id },
            data: {
              name: t.name,
              description: t.description,
              sampleType: t.sampleType,
              specimenType: t.specimenType ?? t.sampleType,
              turnaroundHours: t.turnaroundHours,
              price: t.price as any,
              userCode: t.userCode,
              loincCode: t.loincCode,
              department: t.department,
              method: t.method,
              ...(typeof t.isActive === 'boolean' ? { isActive: t.isActive } : {}),
            },
          });
          summary.updated++;
        } else {
          await prisma.catalogTest.create({
            data: {
              tenantId,
              externalId: t.externalId,
              name: t.name,
              description: t.description,
              sampleType: t.sampleType,
              specimenType: t.specimenType ?? t.sampleType,
              turnaroundHours: t.turnaroundHours,
              price: t.price as any,
              userCode: t.userCode,
              loincCode: t.loincCode,
              department: t.department,
              method: t.method,
              ...(typeof t.isActive === 'boolean' ? { isActive: t.isActive } : {}),
            },
          });
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
          where: { tenant_param_externalId: { tenantId, externalId: p.externalId } },
        });
        if (existing) {
          await prisma.parameter.update({
            where: { id: existing.id },
            data: {
              name: p.name,
              unit: p.unit,
              dataType: p.dataType,
              userCode: p.userCode,
              loincCode: p.loincCode,
              resultType: p.resultType,
              defaultUnit: p.defaultUnit,
              decimals: p.decimals,
              allowedValues: p.allowedValues,
              defaultValue: p.defaultValue,
              ...(typeof p.isActive === 'boolean' ? { isActive: p.isActive } : {}),
            },
          });
          summary.updated++;
        } else {
          await prisma.parameter.create({
            data: {
              tenantId,
              externalId: p.externalId,
              name: p.name,
              unit: p.unit,
              dataType: p.dataType,
              userCode: p.userCode,
              loincCode: p.loincCode,
              resultType: p.resultType,
              defaultUnit: p.defaultUnit,
              decimals: p.decimals,
              allowedValues: p.allowedValues,
              defaultValue: p.defaultValue,
              ...(typeof p.isActive === 'boolean' ? { isActive: p.isActive } : {}),
            },
          });
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
          where: { tenant_panel_externalId: { tenantId, externalId: panel.externalId } },
        });
        if (existing) {
          await prisma.catalogPanel.update({
            where: { id: existing.id },
            data: {
              name: panel.name,
              description: panel.description,
              userCode: panel.userCode,
              loincCode: panel.loincCode,
              price: panel.price as any,
              ...(typeof panel.isActive === 'boolean' ? { isActive: panel.isActive } : {}),
            },
          });
          summary.updated++;
        } else {
          await prisma.catalogPanel.create({
            data: {
              tenantId,
              externalId: panel.externalId,
              name: panel.name,
              description: panel.description,
              userCode: panel.userCode,
              loincCode: panel.loincCode,
              price: panel.price as any,
              ...(typeof panel.isActive === 'boolean' ? { isActive: panel.isActive } : {}),
            },
          });
          summary.created++;
        }
        summary.total++;
      }
    }

    // Upsert test-parameter mappings
    const mappings = payload.mappings ?? [];
    for (const m of mappings) {
      const test = await prisma.catalogTest.findUnique({ where: { tenant_test_externalId: { tenantId, externalId: m.testExternalId } } });
      const param = await prisma.parameter.findUnique({ where: { tenant_param_externalId: { tenantId, externalId: m.parameterExternalId } } });
      if (!test || !param) { summary.skipped++; continue; }

      const existing = await prisma.testParameterMapping.findUnique({
        where: { tenantId_testId_parameterId: { tenantId, testId: test.id, parameterId: param.id } },
      });
      if (!existing) {
        await prisma.testParameterMapping.create({
          data: {
            tenantId,
            testId: test.id,
            parameterId: param.id,
            ordering: m.ordering ?? m.displayOrder ?? 0,
            displayOrder: m.displayOrder ?? m.ordering ?? 0,
            isRequired: m.isRequired ?? true,
            unitOverride: m.unitOverride,
          },
        });
        summary.created++;
      } else {
        await prisma.testParameterMapping.update({
          where: { id: existing.id },
          data: {
            ordering: m.ordering ?? m.displayOrder ?? existing.ordering,
            displayOrder: m.displayOrder ?? m.ordering ?? existing.displayOrder,
            ...(typeof m.isRequired === 'boolean' ? { isRequired: m.isRequired } : {}),
            ...(m.unitOverride !== undefined ? { unitOverride: m.unitOverride } : {}),
          },
        });
        summary.updated++;
      }
      summary.total++;
    }

    // Upsert panel-test mappings
    const panelMappings = payload.panelMappings ?? [];
    for (const m of panelMappings) {
      const panel = await prisma.catalogPanel.findUnique({ where: { tenant_panel_externalId: { tenantId, externalId: m.panelExternalId } } });
      const test = await prisma.catalogTest.findUnique({ where: { tenant_test_externalId: { tenantId, externalId: m.testExternalId } } });
      if (!panel || !test) { summary.skipped++; summary.total++; continue; }

      const existing = await prisma.panelTestMapping.findUnique({
        where: { tenantId_panelId_testId: { tenantId, panelId: panel.id, testId: test.id } },
      });
      if (!existing) {
        await prisma.panelTestMapping.create({
          data: {
            tenantId,
            panelId: panel.id,
            testId: test.id,
            ordering: m.ordering ?? m.displayOrder ?? 0,
            displayOrder: m.displayOrder ?? m.ordering ?? 0,
          },
        });
        summary.created++;
      } else {
        await prisma.panelTestMapping.update({
          where: { id: existing.id },
          data: {
            ordering: m.ordering ?? m.displayOrder ?? existing.ordering,
            displayOrder: m.displayOrder ?? m.ordering ?? existing.displayOrder,
          },
        });
        summary.updated++;
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
