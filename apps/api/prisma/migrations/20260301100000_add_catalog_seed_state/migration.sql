-- Add catalog seed state fields to tenants table
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "catalogSeedMode"        TEXT,
  ADD COLUMN IF NOT EXISTS "catalogSeededAt"        TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "catalogSeedBaseVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "catalogSeedHash"        TEXT;
