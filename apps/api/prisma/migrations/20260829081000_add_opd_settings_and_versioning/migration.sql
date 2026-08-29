-- DropIndex
DROP INDEX "opd_notes_tenantId_opdEncounterId_key";
DROP INDEX "opd_prescriptions_kmvp_tenantId_opdEncounterId_key";

-- AlterTable
ALTER TABLE "opd_notes" ADD COLUMN "amendmentReason" TEXT;
ALTER TABLE "opd_notes" ADD COLUMN "amendedById" TEXT;
ALTER TABLE "opd_notes" ADD COLUMN "amendmentStatus" TEXT;

-- AlterTable
ALTER TABLE "opd_prescriptions_kmvp" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "opd_prescriptions_kmvp" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "opd_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "refundMaxLimitPct" INTEGER NOT NULL DEFAULT 100,
    "queueRule" TEXT NOT NULL DEFAULT 'CHECK_IN_TIME',
    "retentionYears" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opd_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "opd_settings_tenantId_key" ON "opd_settings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "opd_notes_tenantId_opdEncounterId_version_key" ON "opd_notes"("tenantId", "opdEncounterId", "version");
CREATE UNIQUE INDEX "opd_prescriptions_kmvp_tenantId_opdEncounterId_version_key" ON "opd_prescriptions_kmvp"("tenantId", "opdEncounterId", "version");

-- AddForeignKey
ALTER TABLE "opd_settings" ADD CONSTRAINT "opd_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
