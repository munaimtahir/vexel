-- Drop old global unique on email, add tenant-scoped unique
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_email_key" ON "users"("tenantId", "email");
