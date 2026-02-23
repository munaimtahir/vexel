-- Migration: ucum_cascade_specimen_receive
-- Adds UCUM unit codes, CASCADE deletes on mapping tables, specimen receivedAt field

-- DropForeignKey
ALTER TABLE "panel_test_mappings" DROP CONSTRAINT "panel_test_mappings_panelId_fkey";
ALTER TABLE "panel_test_mappings" DROP CONSTRAINT "panel_test_mappings_testId_fkey";
ALTER TABLE "test_parameter_mappings" DROP CONSTRAINT "test_parameter_mappings_parameterId_fkey";
ALTER TABLE "test_parameter_mappings" DROP CONSTRAINT "test_parameter_mappings_testId_fkey";

-- AlterTable: add ucumCode to lab_results
ALTER TABLE "lab_results" ADD COLUMN "ucumCode" TEXT;

-- AlterTable: add ucumCode to parameters
ALTER TABLE "parameters" ADD COLUMN "ucumCode" TEXT;

-- AlterTable: add receivedAt to specimens
ALTER TABLE "specimens" ADD COLUMN "receivedAt" TIMESTAMP(3);

-- AddForeignKey with CASCADE
ALTER TABLE "test_parameter_mappings" ADD CONSTRAINT "test_parameter_mappings_testId_fkey" FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "test_parameter_mappings" ADD CONSTRAINT "test_parameter_mappings_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "parameters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "panel_test_mappings" ADD CONSTRAINT "panel_test_mappings_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "catalog_panels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "panel_test_mappings" ADD CONSTRAINT "panel_test_mappings_testId_fkey" FOREIGN KEY ("testId") REFERENCES "catalog_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
