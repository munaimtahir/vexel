-- Link canonical OPD doctors to authenticated clinician users for ownership enforcement.
ALTER TABLE "opd_doctors" ADD COLUMN "userId" TEXT;

ALTER TABLE "opd_doctors"
  ADD CONSTRAINT "opd_doctors_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "opd_doctors_tenantId_userId_idx" ON "opd_doctors"("tenantId", "userId");
