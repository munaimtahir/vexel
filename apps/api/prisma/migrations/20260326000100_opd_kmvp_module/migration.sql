CREATE TABLE "opd_doctors" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "specialtyName" TEXT NOT NULL,
  "consultationFee" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'PKR',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_doctors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_encounters" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "encounterId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REGISTERED',
  "visitCode" TEXT NOT NULL,
  "chiefComplaint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_encounters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_vitals_kmvp" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "opdEncounterId" TEXT NOT NULL,
  "bpSystolic" INTEGER,
  "bpDiastolic" INTEGER,
  "pulse" INTEGER,
  "temperatureC" DECIMAL(4,1),
  "respRate" INTEGER,
  "spo2" INTEGER,
  "weightKg" DECIMAL(5,2),
  "heightCm" DECIMAL(5,2),
  "bmi" DECIMAL(5,2),
  "enteredBy" TEXT,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_vitals_kmvp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_notes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "opdEncounterId" TEXT NOT NULL,
  "historyNotes" TEXT,
  "examNotes" TEXT,
  "assessment" TEXT,
  "plan" TEXT,
  "advice" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "opd_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_prescriptions_kmvp" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "opdEncounterId" TEXT NOT NULL,
  "publishedDocumentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_prescriptions_kmvp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_prescription_items_kmvp" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "opdPrescriptionId" TEXT NOT NULL,
  "drugName" TEXT NOT NULL,
  "genericName" TEXT,
  "strength" TEXT,
  "dose" TEXT,
  "frequency" TEXT,
  "duration" TEXT,
  "route" TEXT,
  "instructions" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_prescription_items_kmvp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_command_logs" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "commandName" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestJson" JSONB,
  "responseJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_command_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "opd_doctors_tenantId_code_key" ON "opd_doctors"("tenantId", "code");
CREATE INDEX "opd_doctors_tenantId_isActive_sortOrder_idx" ON "opd_doctors"("tenantId", "isActive", "sortOrder");
CREATE INDEX "opd_doctors_tenantId_displayName_idx" ON "opd_doctors"("tenantId", "displayName");

CREATE UNIQUE INDEX "opd_encounters_tenantId_visitCode_key" ON "opd_encounters"("tenantId", "visitCode");
CREATE UNIQUE INDEX "opd_encounters_tenantId_encounterId_key" ON "opd_encounters"("tenantId", "encounterId");
CREATE INDEX "opd_encounters_tenantId_patientId_createdAt_idx" ON "opd_encounters"("tenantId", "patientId", "createdAt");
CREATE INDEX "opd_encounters_tenantId_doctorId_createdAt_idx" ON "opd_encounters"("tenantId", "doctorId", "createdAt");
CREATE INDEX "opd_encounters_tenantId_status_idx" ON "opd_encounters"("tenantId", "status");

CREATE INDEX "opd_vitals_kmvp_tenantId_opdEncounterId_enteredAt_idx" ON "opd_vitals_kmvp"("tenantId", "opdEncounterId", "enteredAt");

CREATE UNIQUE INDEX "opd_notes_tenantId_opdEncounterId_key" ON "opd_notes"("tenantId", "opdEncounterId");
CREATE INDEX "opd_notes_tenantId_updatedAt_idx" ON "opd_notes"("tenantId", "updatedAt");

CREATE UNIQUE INDEX "opd_prescriptions_kmvp_tenantId_opdEncounterId_key" ON "opd_prescriptions_kmvp"("tenantId", "opdEncounterId");
CREATE INDEX "opd_prescriptions_kmvp_tenantId_createdAt_idx" ON "opd_prescriptions_kmvp"("tenantId", "createdAt");

CREATE UNIQUE INDEX "opd_prescription_items_kmvp_tenantId_opdPrescriptionId_sortOrder_key" ON "opd_prescription_items_kmvp"("tenantId", "opdPrescriptionId", "sortOrder");
CREATE INDEX "opd_prescription_items_kmvp_tenantId_opdPrescriptionId_idx" ON "opd_prescription_items_kmvp"("tenantId", "opdPrescriptionId");

CREATE UNIQUE INDEX "opd_command_logs_tenantId_commandName_idempotencyKey_key" ON "opd_command_logs"("tenantId", "commandName", "idempotencyKey");
CREATE INDEX "opd_command_logs_tenantId_createdAt_idx" ON "opd_command_logs"("tenantId", "createdAt");

ALTER TABLE "opd_doctors" ADD CONSTRAINT "opd_doctors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "opd_doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_vitals_kmvp" ADD CONSTRAINT "opd_vitals_kmvp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_vitals_kmvp" ADD CONSTRAINT "opd_vitals_kmvp_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_notes" ADD CONSTRAINT "opd_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_notes" ADD CONSTRAINT "opd_notes_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_prescriptions_kmvp" ADD CONSTRAINT "opd_prescriptions_kmvp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_prescriptions_kmvp" ADD CONSTRAINT "opd_prescriptions_kmvp_opdEncounterId_fkey" FOREIGN KEY ("opdEncounterId") REFERENCES "opd_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_prescriptions_kmvp" ADD CONSTRAINT "opd_prescriptions_kmvp_publishedDocumentId_fkey" FOREIGN KEY ("publishedDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "opd_prescription_items_kmvp" ADD CONSTRAINT "opd_prescription_items_kmvp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_prescription_items_kmvp" ADD CONSTRAINT "opd_prescription_items_kmvp_opdPrescriptionId_fkey" FOREIGN KEY ("opdPrescriptionId") REFERENCES "opd_prescriptions_kmvp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_command_logs" ADD CONSTRAINT "opd_command_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
