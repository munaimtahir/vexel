import { Job } from 'bullmq';
import { prisma } from './prisma';
import * as https from 'https';
import * as http from 'http';

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL ?? 'http://pdf-service:5002';

interface RenderJobData {
  documentId: string;
  tenantId: string;
  correlationId: string;
}

async function writeAudit(
  tenantId: string,
  action: string,
  documentId: string,
  correlationId: string,
  extra?: Record<string, unknown>,
) {
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId,
        action,
        entityType: 'Document',
        entityId: documentId,
        correlationId,
        after: extra ?? null,
      },
    });
  } catch (err) {
    console.error('[document-render] Failed to write audit event:', (err as Error).message);
  }
}

function postJson(url: string, body: string, timeoutMs = 30_000): Promise<{ pdfHash: string; bytes: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = lib.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const bytes = Buffer.concat(chunks);
        const pdfHash = (res.headers['x-pdf-hash'] as string) ?? '';
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`PDF service returned ${res.statusCode}: ${bytes.toString()}`));
        } else {
          resolve({ pdfHash, bytes });
        }
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`PDF service request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function processDocumentRender(job: Job<RenderJobData>) {
  const { documentId, tenantId, correlationId } = job.data;

  // Fetch document with template
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { template: true },
  });

  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  // Idempotent: already rendered or published
  if (doc.status === 'RENDERED' || doc.status === 'PUBLISHED') {
    console.log(`[document-render] Document ${documentId} already ${doc.status}, skipping`);
    return;
  }

  // Reset FAILED to RENDERING if retried
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'RENDERING', errorMessage: null },
  });

  // Fetch tenant config for branding
  const tenantConfig = await prisma.tenantConfig.findUnique({ where: { tenantId } });

  const renderBody = JSON.stringify({
    templateKey: doc.template.templateKey,
    payloadJson: doc.payloadJson,
    brandingConfig: tenantConfig ?? {},
  });

  try {
    const { pdfHash } = await postJson(`${PDF_SERVICE_URL}/render`, renderBody);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'RENDERED', pdfHash: pdfHash || null },
    });

    await writeAudit(tenantId, 'document.rendered', documentId, correlationId, { pdfHash });
    console.log(`[document-render] Document ${documentId} rendered, hash=${pdfHash}`);
  } catch (err) {
    const errorMessage = (err as Error).message;
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED', errorMessage },
    });

    await writeAudit(tenantId, 'document.render_failed', documentId, correlationId, { errorMessage });
    console.error(`[document-render] Document ${documentId} failed:`, errorMessage);
    throw err; // Re-throw so BullMQ can retry
  }
}
