-- OPD MVP data model scaffold (manually generated from prisma migrate diff)
-- Note: prisma migrate dev --create-only was blocked by legacy shadow DB migration failure (P3006).

-- AlterTable
ALTER TABLE "encounters" ADD COLUMN "moduleType" TEXT NOT NULL DEFAULT 'LIMS';

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT,
    "displayName" TEXT NOT NULL,
    "specialty" TEXT,
    "registrationNo" TEXT,
    "qualification" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_schedules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "appointmentCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "reason" TEXT,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "consultationStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "noShowMarkedAt" TIMESTAMP(3),
    "bookedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_visits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "visitCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "chiefComplaint" TEXT,
    "queueNumber" TEXT,
    "waitingAt" TIMESTAMP(3),
    "consultationStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "opd_visits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_vitals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "bmi" DECIMAL(5,2),
    "temperatureC" DECIMAL(4,1),
    "pulseBpm" INTEGER,
    "systolicBp" INTEGER,
    "diastolicBp" INTEGER,
    "respiratoryRate" INTEGER,
    "spo2Pct" INTEGER,
    "bloodGlucoseMgDl" DECIMAL(6,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "opd_vitals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_clinical_notes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "subjectiveJson" JSONB,
    "objectiveJson" JSONB,
    "assessmentJson" JSONB,
    "planJson" JSONB,
    "diagnosisText" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "opd_clinical_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_prescriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "signedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "opd_prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_prescription_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "medicationText" TEXT NOT NULL,
    "dosageText" TEXT,
    "frequencyText" TEXT,
    "durationText" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "opd_prescription_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "opdVisitId" TEXT,
    "invoiceCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "subtotalAmount" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lineType" TEXT NOT NULL DEFAULT 'SERVICE',
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(10,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT,
    "referenceNo" TEXT,
    "note" TEXT,
    "correlationId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Indexes and tenant-scoped uniques
CREATE INDEX "providers_tenantId_isActive_idx" ON "providers"("tenantId", "isActive");
CREATE INDEX "providers_tenantId_displayName_idx" ON "providers"("tenantId", "displayName");
CREATE UNIQUE INDEX "providers_tenantId_code_key" ON "providers"("tenantId", "code");
CREATE UNIQUE INDEX "providers_tenantId_registrationNo_key" ON "providers"("tenantId", "registrationNo");

CREATE INDEX "provider_schedules_tenantId_providerId_weekday_isActive_idx" ON "provider_schedules"("tenantId", "providerId", "weekday", "isActive");
CREATE UNIQUE INDEX "provider_schedules_tenantId_providerId_weekday_startTime_en_key" ON "provider_schedules"("tenantId", "providerId", "weekday", "startTime", "endTime");

CREATE INDEX "appointments_tenantId_status_scheduledAt_idx" ON "appointments"("tenantId", "status", "scheduledAt");
CREATE INDEX "appointments_tenantId_patientId_scheduledAt_idx" ON "appointments"("tenantId", "patientId", "scheduledAt");
CREATE INDEX "appointments_tenantId_providerId_scheduledAt_idx" ON "appointments"("tenantId", "providerId", "scheduledAt");
CREATE UNIQUE INDEX "appointments_tenantId_appointmentCode_key" ON "appointments"("tenantId", "appointmentCode");

CREATE INDEX "opd_visits_tenantId_status_createdAt_idx" ON "opd_visits"("tenantId", "status", "createdAt");
CREATE INDEX "opd_visits_tenantId_patientId_createdAt_idx" ON "opd_visits"("tenantId", "patientId", "createdAt");
CREATE INDEX "opd_visits_tenantId_providerId_createdAt_idx" ON "opd_visits"("tenantId", "providerId", "createdAt");
CREATE INDEX "opd_visits_tenantId_appointmentId_idx" ON "opd_visits"("tenantId", "appointmentId");
CREATE UNIQUE INDEX "opd_visits_tenantId_encounterId_key" ON "opd_visits"("tenantId", "encounterId");
CREATE UNIQUE INDEX "opd_visits_tenantId_appointmentId_key" ON "opd_visits"("tenantId", "appointmentId");
CREATE UNIQUE INDEX "opd_visits_tenantId_visitCode_key" ON "opd_visits"("tenantId", "visitCode");

CREATE INDEX "opd_vitals_tenantId_visitId_recordedAt_idx" ON "opd_vitals"("tenantId", "visitId", "recordedAt");

CREATE INDEX "opd_clinical_notes_tenantId_providerId_createdAt_idx" ON "opd_clinical_notes"("tenantId", "providerId", "createdAt");
CREATE INDEX "opd_clinical_notes_tenantId_status_idx" ON "opd_clinical_notes"("tenantId", "status");
CREATE UNIQUE INDEX "opd_clinical_notes_tenantId_visitId_key" ON "opd_clinical_notes"("tenantId", "visitId");

CREATE INDEX "opd_prescriptions_tenantId_providerId_createdAt_idx" ON "opd_prescriptions"("tenantId", "providerId", "createdAt");
CREATE INDEX "opd_prescriptions_tenantId_status_idx" ON "opd_prescriptions"("tenantId", "status");
CREATE UNIQUE INDEX "opd_prescriptions_tenantId_visitId_key" ON "opd_prescriptions"("tenantId", "visitId");

CREATE INDEX "opd_prescription_items_tenantId_prescriptionId_idx" ON "opd_prescription_items"("tenantId", "prescriptionId");
CREATE UNIQUE INDEX "opd_prescription_items_tenantId_prescriptionId_sortOrder_key" ON "opd_prescription_items"("tenantId", "prescriptionId", "sortOrder");

CREATE INDEX "invoices_tenantId_status_createdAt_idx" ON "invoices"("tenantId", "status", "createdAt");
CREATE INDEX "invoices_tenantId_patientId_createdAt_idx" ON "invoices"("tenantId", "patientId", "createdAt");
CREATE INDEX "invoices_tenantId_opdVisitId_idx" ON "invoices"("tenantId", "opdVisitId");
CREATE INDEX "invoices_tenantId_encounterId_idx" ON "invoices"("tenantId", "encounterId");
CREATE UNIQUE INDEX "invoices_tenantId_invoiceCode_key" ON "invoices"("tenantId", "invoiceCode");

CREATE INDEX "invoice_lines_tenantId_invoiceId_idx" ON "invoice_lines"("tenantId", "invoiceId");
CREATE UNIQUE INDEX "invoice_lines_tenantId_invoiceId_sortOrder_key" ON "invoice_lines"("tenantId", "invoiceId", "sortOrder");

CREATE INDEX "payments_tenantId_invoiceId_receivedAt_idx" ON "payments"("tenantId", "invoiceId", "receivedAt");
CREATE INDEX "payments_tenantId_status_idx" ON "payments"("tenantId", "status");
CREATE INDEX "payments_tenantId_correlationId_idx" ON "payments"("tenantId", "correlationId");
CREATE UNIQUE INDEX "payments_tenantId_paymentCode_key" ON "payments"("tenantId", "paymentCode");

CREATE INDEX "encounters_tenantId_moduleType_status_idx" ON "encounters"("tenantId", "moduleType", "status");

-- Foreign keys
ALTER TABLE "providers" ADD CONSTRAINT "providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_schedules" ADD CONSTRAINT "provider_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_schedules" ADD CONSTRAINT "provider_schedules_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_visits" ADD CONSTRAINT "opd_visits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_visits" ADD CONSTRAINT "opd_visits_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_visits" ADD CONSTRAINT "opd_visits_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_visits" ADD CONSTRAINT "opd_visits_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_visits" ADD CONSTRAINT "opd_visits_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "opd_vitals" ADD CONSTRAINT "opd_vitals_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_vitals" ADD CONSTRAINT "opd_vitals_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "opd_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_clinical_notes" ADD CONSTRAINT "opd_clinical_notes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_clinical_notes" ADD CONSTRAINT "opd_clinical_notes_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "opd_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_clinical_notes" ADD CONSTRAINT "opd_clinical_notes_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_prescriptions" ADD CONSTRAINT "opd_prescriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_prescriptions" ADD CONSTRAINT "opd_prescriptions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "opd_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_prescriptions" ADD CONSTRAINT "opd_prescriptions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_prescription_items" ADD CONSTRAINT "opd_prescription_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_prescription_items" ADD CONSTRAINT "opd_prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "opd_prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_opdVisitId_fkey" FOREIGN KEY ("opdVisitId") REFERENCES "opd_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
