-- Add missing tenant_configs layout/footer columns expected by Prisma schema/runtime.
ALTER TABLE "tenant_configs"
  ADD COLUMN IF NOT EXISTS "reportHeaderLayout" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptHeaderLayout" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptLayout" TEXT,
  ADD COLUMN IF NOT EXISTS "reportFooterImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "reportFooterLayout" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptFooterLayout" TEXT;
