-- Add variantJson column to tenant_features for variant-type feature flags
ALTER TABLE "tenant_features" ADD COLUMN IF NOT EXISTS "variantJson" TEXT;
