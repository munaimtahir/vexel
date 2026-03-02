-- CreateEnum
CREATE TYPE "ImpersonationMode" AS ENUM ('READ_ONLY');

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "impersonatedUserId" TEXT NOT NULL,
    "mode" "ImpersonationMode" NOT NULL DEFAULT 'READ_ONLY',
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedIp" TEXT,
    "endedIp" TEXT,
    "userAgent" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "blockedWriteCount" INTEGER NOT NULL DEFAULT 0,
    "lastBlockedMethod" TEXT,
    "lastBlockedPath" TEXT,
    "lastBlockedAt" TIMESTAMP(3),

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "impersonation_sessions_startedById_startedAt_idx" ON "impersonation_sessions"("startedById", "startedAt");

-- CreateIndex
CREATE INDEX "impersonation_sessions_impersonatedUserId_startedAt_idx" ON "impersonation_sessions"("impersonatedUserId", "startedAt");

-- CreateIndex
CREATE INDEX "impersonation_sessions_isActive_idx" ON "impersonation_sessions"("isActive");

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_impersonatedUserId_fkey" FOREIGN KEY ("impersonatedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
