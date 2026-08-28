CREATE TABLE "opd_schedules" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "slotMinutes" INTEGER NOT NULL DEFAULT 15,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "opd_appointments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "appointmentCode" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
  "durationMinutes" INTEGER NOT NULL DEFAULT 15,
  "status" TEXT NOT NULL DEFAULT 'BOOKED',
  "reason" TEXT,
  "checkedInAt" TIMESTAMP(3),
  "consultationStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledReason" TEXT,
  "noShowMarkedAt" TIMESTAMP(3),
  "bookedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "opd_appointments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "opd_encounters" ADD COLUMN "appointmentId" TEXT;
CREATE UNIQUE INDEX "opd_encounters_appointmentId_key" ON "opd_encounters"("appointmentId");
CREATE UNIQUE INDEX "opd_schedules_tenantId_doctorId_weekday_startTime_endTime_key" ON "opd_schedules"("tenantId", "doctorId", "weekday", "startTime", "endTime");
CREATE INDEX "opd_schedules_tenantId_doctorId_weekday_isActive_idx" ON "opd_schedules"("tenantId", "doctorId", "weekday", "isActive");
CREATE UNIQUE INDEX "opd_appointments_tenantId_appointmentCode_key" ON "opd_appointments"("tenantId", "appointmentCode");
CREATE UNIQUE INDEX "opd_appointments_tenantId_doctorId_scheduledAt_key" ON "opd_appointments"("tenantId", "doctorId", "scheduledAt");
CREATE INDEX "opd_appointments_tenantId_status_scheduledAt_idx" ON "opd_appointments"("tenantId", "status", "scheduledAt");
CREATE INDEX "opd_appointments_tenantId_patientId_scheduledAt_idx" ON "opd_appointments"("tenantId", "patientId", "scheduledAt");
CREATE INDEX "opd_appointments_tenantId_doctorId_scheduledAt_idx" ON "opd_appointments"("tenantId", "doctorId", "scheduledAt");

ALTER TABLE "opd_schedules" ADD CONSTRAINT "opd_schedules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_schedules" ADD CONSTRAINT "opd_schedules_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "opd_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "opd_appointments" ADD CONSTRAINT "opd_appointments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_appointments" ADD CONSTRAINT "opd_appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_appointments" ADD CONSTRAINT "opd_appointments_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "opd_doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opd_encounters" ADD CONSTRAINT "opd_encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "opd_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
