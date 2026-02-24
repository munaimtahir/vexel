import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_BUCKET ?? 'vexel-documents';
    this.s3 = new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT ?? 'http://minio:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'vexel',
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vexel_secret_2026',
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    for (let i = 0; i < 5; i++) {
      try {
        await this.ensureBucket();
        return;
      } catch (err) {
        this.logger.warn(`Bucket init attempt ${i + 1} failed: ${(err as Error).message}`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket ${this.bucket}`);
    }
  }

  async upload(key: string, body: Buffer, contentType = 'application/pdf'): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    this.logger.log(`Uploaded ${key} to bucket ${this.bucket}`);
  }

  async download(key: string): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const publicUrl = process.env.STORAGE_PUBLIC_URL;
    // Use a separate S3 client with the public URL so the presigned URL uses the correct host
    const signingClient = publicUrl
      ? new S3Client({
          endpoint: publicUrl,
          region: 'us-east-1',
          credentials: {
            accessKeyId: process.env.STORAGE_ACCESS_KEY ?? 'vexel',
            secretAccessKey: process.env.STORAGE_SECRET_KEY ?? 'vexel_secret_2026',
          },
          forcePathStyle: true,
        })
      : this.s3;
    return getSignedUrl(signingClient, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
  }

  storageKey(tenantId: string, documentId: string): string {
    return `${tenantId}/${documentId}/report.pdf`;
  }
}
