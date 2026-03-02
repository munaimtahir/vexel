const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const text = fs.readFileSync('/home/munaim/srv/apps/vexel/VEXEL_CATALOG_TEST_PARAMETERS_MAPPING.csv', 'utf-8');
    const lines = text.split('\n').filter(l => l.trim()).slice(1);
    let imported = 0;
    let skipped = 0;
    for (const line of lines) {
        const cols = line.split(',');
        if (cols.length < 4) continue;
        const testUserCode = cols[0].trim();
        const paramUserCode = cols[1].trim();
        const displayOrder = parseInt(cols[2].trim() || '1', 10);
        const isRequired = cols[3].trim().toLowerCase() === 'true';
        const unitOverride = cols[4] ? cols[4].trim() : null;

        const test = await prisma.catalogTest.findFirst({
            where: { tenantId: 'system', userCode: { equals: testUserCode, mode: 'insensitive' } }
        });
        if (!test) {
            console.log(`Test not found: ${testUserCode}`);
            skipped++;
            continue;
        }

        let param = await prisma.parameter.findFirst({
            where: { tenantId: 'system', userCode: { equals: paramUserCode, mode: 'insensitive' } }
        });

        if (!param) {
            param = await prisma.parameter.findFirst({
                where: { tenantId: 'system', externalId: paramUserCode }
            });
        }

        if (!param) {
            console.log(`Parameter not found: ${paramUserCode} for test ${testUserCode}`);
            skipped++;
            continue;
        }

        await prisma.testParameterMapping.upsert({
            where: {
                tenantId_testId_parameterId: {
                    tenantId: 'system',
                    testId: test.id,
                    parameterId: param.id
                }
            },
            create: {
                tenantId: 'system',
                testId: test.id,
                parameterId: param.id,
                displayOrder,
                ordering: displayOrder,
                isRequired,
                unitOverride: unitOverride || null
            },
            update: {
                displayOrder,
                ordering: displayOrder,
                isRequired,
                unitOverride: unitOverride || null
            }
        });
        imported++;
    }
    console.log(`Done. Imported: ${imported}, Skipped: ${skipped}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
