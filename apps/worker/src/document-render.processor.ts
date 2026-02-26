import { Job } from 'bullmq';
import { prisma } from './prisma';
import * as https from 'https';
import * as http from 'http';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';

interface RenderJobData {
  documentId: string;
  tenantId: string;
  correlationId: string;
}

function getS3Client() {
  return new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://minio:9000',
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'vexel',
      secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vexel_secret_2026',
    },
    forcePathStyle: true,
  });
}

async function uploadToStorage(tenantId: string, documentId: string, bytes: Buffer): Promise<string> {
  const bucket = process.env.STORAGE_BUCKET ?? 'vexel-documents';
  const key = `${tenantId}/${documentId}/report.pdf`;
  const s3 = getS3Client();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: 'application/pdf',
  }));
  return key;
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
        after: (extra ?? null) as any,
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
    const { pdfHash, bytes } = await postJson(`${PDF_SERVICE_URL}/render`, renderBody);

    // Upload to MinIO
    const storageKey = await uploadToStorage(tenantId, documentId, bytes);

    // Transition to RENDERED first (preserves state machine integrity)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'RENDERED',
        pdfHash: pdfHash || null,
        storageKey,
      },
    });
    await writeAudit(tenantId, 'document.rendered', documentId, correlationId, { pdfHash, storageKey });
    console.log(`[document-render] Document ${documentId} rendered, key=${storageKey}`);
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
