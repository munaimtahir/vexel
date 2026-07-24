-- Add paymentMode to cash_transactions for pilot-readiness financial reporting (Phase 1/3)
ALTER TABLE "cash_transactions" ADD COLUMN "paymentMode" TEXT NOT NULL DEFAULT 'CASH';
