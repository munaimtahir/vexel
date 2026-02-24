-- Migration: add_catalog_panel_price
ALTER TABLE "catalog_panels"
  ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2);
