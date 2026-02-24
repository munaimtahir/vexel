-- Add maxDiscountPct to roles and users
ALTER TABLE "roles" ADD COLUMN "maxDiscountPct" DECIMAL(5,2);
ALTER TABLE "users" ADD COLUMN "maxDiscountPct" DECIMAL(5,2);

-- Add financial fields to lab_orders
ALTER TABLE "lab_orders" ADD COLUMN "totalAmount"    DECIMAL(10,2);
ALTER TABLE "lab_orders" ADD COLUMN "discountAmount" DECIMAL(10,2);
ALTER TABLE "lab_orders" ADD COLUMN "discountPct"    DECIMAL(5,2);
ALTER TABLE "lab_orders" ADD COLUMN "payableAmount"  DECIMAL(10,2);
ALTER TABLE "lab_orders" ADD COLUMN "amountPaid"     DECIMAL(10,2);
ALTER TABLE "lab_orders" ADD COLUMN "dueAmount"      DECIMAL(10,2);
ALTER TABLE "lab_orders" ADD COLUMN "cancelledAt"    TIMESTAMP(3);
ALTER TABLE "lab_orders" ADD COLUMN "cancelReason"   TEXT;

-- Create cash_transactions table
CREATE TABLE "cash_transactions" (
    "id"            TEXT NOT NULL,
    "tenantId"      TEXT NOT NULL,
    "encounterId"   TEXT NOT NULL,
    "labOrderId"    TEXT,
    "type"          TEXT NOT NULL,
    "amount"        DECIMAL(10,2) NOT NULL,
    "actorUserId"   TEXT NOT NULL,
    "reason"        TEXT,
    "correlationId" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "cash_transactions_tenantId_encounterId_idx" ON "cash_transactions"("tenantId", "encounterId");
CREATE INDEX "cash_transactions_tenantId_actorUserId_idx" ON "cash_transactions"("tenantId", "actorUserId");
CREATE INDEX "cash_transactions_tenantId_type_idx"        ON "cash_transactions"("tenantId", "type");
CREATE INDEX "cash_transactions_tenantId_createdAt_idx"   ON "cash_transactions"("tenantId", "createdAt");

-- Foreign keys
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_tenantId_fkey"    FOREIGN KEY ("tenantId")    REFERENCES "tenants"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_labOrderId_fkey"  FOREIGN KEY ("labOrderId")  REFERENCES "lab_orders"("id") ON DELETE SET NULL  ON UPDATE CASCADE;
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id")      ON DELETE RESTRICT ON UPDATE CASCADE;
