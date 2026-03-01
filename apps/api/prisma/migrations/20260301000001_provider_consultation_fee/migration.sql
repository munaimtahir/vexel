-- AlterTable: add consultationFee to providers
ALTER TABLE "providers" ADD COLUMN "consultationFee" DECIMAL(10,2);
