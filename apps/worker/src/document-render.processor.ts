import { Job } from 'bullmq';
import { prisma } from './prisma';
import * as https from 'https';
import * as http from 'http';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL ?? 'http://pdf:8080';

// RECEIPTs are auto-published immediately after rendering (no manual publish step needed)
const AUTO_PUBLISH_TYPES = new Set(['RECEIPT', 'OPD_INVOICE_RECEIPT']);

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

function postJson(
  url: string,
  body: string,
  correlationId: string,
  timeoutMs = 60_000,
): Promise<{ pdfHash: string; bytes: Buffer }> {
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
        'X-Correlation-ID': correlationId,
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
  const t0 = Date.now();
  const logCtx = `[document-render] correlationId=${correlationId} docId=${documentId}`;

  // Fetch document with template
  const tFetch = Date.now();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { template: true },
  });
  console.log(`${logCtx} fetch_doc_ms=${Date.now() - tFetch} type=${doc?.type ?? 'unknown'}`);

  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }

  // Idempotent: already rendered or published
  if (doc.status === 'RENDERED' || doc.status === 'PUBLISHED') {
    console.log(`${logCtx} status=${doc.status} → skipping (idempotent)`);
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
    const tPdf = Date.now();
    const { pdfHash, bytes } = await postJson(
      `${PDF_SERVICE_URL}/render`,
      renderBody,
      correlationId,
    );
    console.log(`${logCtx} pdf_render_ms=${Date.now() - tPdf} bytes=${bytes.length}`);

    // Upload to MinIO
    const tUpload = Date.now();
    const storageKey = await uploadToStorage(tenantId, documentId, bytes);
    console.log(`${logCtx} storage_upload_ms=${Date.now() - tUpload} key=${storageKey}`);

    // Transition to RENDERED
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'RENDERED', pdfHash: pdfHash || null, storageKey },
    });
    await writeAudit(tenantId, 'document.rendered', documentId, correlationId, { pdfHash, storageKey });

    // Auto-publish receipt types (no manual publish step required)
    if (AUTO_PUBLISH_TYPES.has(doc.type)) {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      await writeAudit(tenantId, 'document.auto_published', documentId, correlationId, { type: doc.type });
      console.log(`${logCtx} auto_published type=${doc.type} total_ms=${Date.now() - t0}`);
    } else {
      console.log(`${logCtx} rendered total_ms=${Date.now() - t0}`);
    }
  } catch (err) {
    const errorMessage = (err as Error).message;
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED', errorMessage },
    });

    await writeAudit(tenantId, 'document.render_failed', documentId, correlationId, { errorMessage });
    console.error(`${logCtx} FAILED total_ms=${Date.now() - t0} error=${errorMessage}`);
    throw err; // Re-throw so BullMQ can retry
  }
}
