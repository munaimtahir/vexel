import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn('[worker] DATABASE_URL not set — Prisma operations will fail');
}

export const prisma = new PrismaClient();

export function getPrismaClient() { return prisma; }
