-- CreateTable
CREATE TABLE "ops_storage_targets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "configJson" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_storage_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_backup_runs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "artifactPath" TEXT,
    "artifactSizeBytes" BIGINT,
    "checksumSha256" TEXT,
    "logPath" TEXT,
    "initiatedByUserId" TEXT,
    "correlationId" TEXT,
    "errorSummary" TEXT,
    "metaJson" JSONB,
    "storageTargetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_backup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_schedules" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tenantId" TEXT,
    "cronExpression" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "retentionPolicyJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_schedule_targets" (
    "scheduleId" TEXT NOT NULL,
    "storageTargetId" TEXT NOT NULL,

    CONSTRAINT "ops_schedule_targets_pkey" PRIMARY KEY ("scheduleId","storageTargetId")
);

-- CreateIndex
CREATE INDEX "ops_storage_targets_tenantId_isEnabled_idx" ON "ops_storage_targets"("tenantId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ops_backup_runs_correlationId_key" ON "ops_backup_runs"("correlationId");

-- CreateIndex
CREATE INDEX "ops_backup_runs_type_status_idx" ON "ops_backup_runs"("type", "status");

-- CreateIndex
CREATE INDEX "ops_backup_runs_tenantId_idx" ON "ops_backup_runs"("tenantId");

-- CreateIndex
CREATE INDEX "ops_backup_runs_createdAt_idx" ON "ops_backup_runs"("createdAt");

-- CreateIndex
CREATE INDEX "ops_schedules_isEnabled_idx" ON "ops_schedules"("isEnabled");

-- AddForeignKey
ALTER TABLE "ops_backup_runs" ADD CONSTRAINT "ops_backup_runs_storageTargetId_fkey" FOREIGN KEY ("storageTargetId") REFERENCES "ops_storage_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_backup_runs" ADD CONSTRAINT "ops_backup_runs_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_schedule_targets" ADD CONSTRAINT "ops_schedule_targets_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ops_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_schedule_targets" ADD CONSTRAINT "ops_schedule_targets_storageTargetId_fkey" FOREIGN KEY ("storageTargetId") REFERENCES "ops_storage_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
