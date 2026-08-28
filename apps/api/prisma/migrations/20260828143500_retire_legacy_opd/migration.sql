-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_opdVisitId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_patientId_fkey";
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_providerId_fkey";
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "opd_clinical_notes" DROP CONSTRAINT "opd_clinical_notes_providerId_fkey";
ALTER TABLE "opd_clinical_notes" DROP CONSTRAINT "opd_clinical_notes_tenantId_fkey";
ALTER TABLE "opd_clinical_notes" DROP CONSTRAINT "opd_clinical_notes_visitId_fkey";

-- DropForeignKey
ALTER TABLE "opd_prescription_items" DROP CONSTRAINT "opd_prescription_items_prescriptionId_fkey";
ALTER TABLE "opd_prescription_items" DROP CONSTRAINT "opd_prescription_items_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "opd_prescriptions" DROP CONSTRAINT "opd_prescriptions_providerId_fkey";
ALTER TABLE "opd_prescriptions" DROP CONSTRAINT "opd_prescriptions_tenantId_fkey";
ALTER TABLE "opd_prescriptions" DROP CONSTRAINT "opd_prescriptions_visitId_fkey";

-- DropForeignKey
ALTER TABLE "opd_visits" DROP CONSTRAINT "opd_visits_appointmentId_fkey";
ALTER TABLE "opd_visits" DROP CONSTRAINT "opd_visits_encounterId_fkey";
ALTER TABLE "opd_visits" DROP CONSTRAINT "opd_visits_patientId_fkey";
ALTER TABLE "opd_visits" DROP CONSTRAINT "opd_visits_providerId_fkey";
ALTER TABLE "opd_visits" DROP CONSTRAINT "opd_visits_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "opd_vitals" DROP CONSTRAINT "opd_vitals_tenantId_fkey";
ALTER TABLE "opd_vitals" DROP CONSTRAINT "opd_vitals_visitId_fkey";

-- DropForeignKey
ALTER TABLE "provider_schedules" DROP CONSTRAINT "provider_schedules_providerId_fkey";
ALTER TABLE "provider_schedules" DROP CONSTRAINT "provider_schedules_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "providers" DROP CONSTRAINT "providers_tenantId_fkey";

-- DropIndex
DROP INDEX "invoices_tenantId_opdVisitId_idx";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "opdVisitId";

-- DropTable
DROP TABLE "appointments";

-- DropTable
DROP TABLE "opd_clinical_notes";

-- DropTable
DROP TABLE "opd_prescription_items";

-- DropTable
DROP TABLE "opd_prescriptions";

-- DropTable
DROP TABLE "opd_visits";

-- DropTable
DROP TABLE "opd_vitals";

-- DropTable
DROP TABLE "provider_schedules";

-- DropTable
DROP TABLE "providers";
