CREATE TYPE "ShiftStatus" AS ENUM ('SCHEDULED', 'CANCELLED');
CREATE TYPE "ShiftBatchType" AS ENUM ('RECURRING_TEMPLATE', 'COPY_WEEK');

CREATE TABLE "schedule_templates" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" INTEGER[] NOT NULL,
    "localStartTime" TEXT NOT NULL,
    "localEndTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "startsOnDate" TIMESTAMP(3) NOT NULL,
    "endsOnDate" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_generation_batches" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "operationType" "ShiftBatchType" NOT NULL,
    "operationKey" TEXT NOT NULL,
    "sourceTemplateId" TEXT,
    "sourceWeekStartUtc" TIMESTAMP(3),
    "targetWeekStartUtc" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_generation_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledStartUtc" TIMESTAMP(3) NOT NULL,
    "scheduledEndUtc" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelReason" TEXT,
    "generationBatchId" TEXT,
    "planningKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shift_generation_batches_operationKey_key" ON "shift_generation_batches"("operationKey");
CREATE UNIQUE INDEX "shifts_planningKey_key" ON "shifts"("planningKey");

CREATE INDEX "schedule_templates_group_id_idx" ON "schedule_templates"("groupId");
CREATE INDEX "schedule_templates_company_id_idx" ON "schedule_templates"("companyId");
CREATE INDEX "schedule_templates_location_id_idx" ON "schedule_templates"("locationId");
CREATE INDEX "schedule_templates_employee_id_idx" ON "schedule_templates"("employeeId");
CREATE INDEX "schedule_templates_archived_at_idx" ON "schedule_templates"("archivedAt");

CREATE INDEX "shift_generation_batches_group_id_idx" ON "shift_generation_batches"("groupId");
CREATE INDEX "shift_generation_batches_company_id_idx" ON "shift_generation_batches"("companyId");
CREATE INDEX "shift_generation_batches_source_template_id_idx" ON "shift_generation_batches"("sourceTemplateId");

CREATE INDEX "shifts_group_id_idx" ON "shifts"("groupId");
CREATE INDEX "shifts_company_id_idx" ON "shifts"("companyId");
CREATE INDEX "shifts_location_id_idx" ON "shifts"("locationId");
CREATE INDEX "shifts_employee_id_idx" ON "shifts"("employeeId");
CREATE INDEX "shifts_scheduled_start_utc_idx" ON "shifts"("scheduledStartUtc");
CREATE INDEX "shifts_scheduled_end_utc_idx" ON "shifts"("scheduledEndUtc");
CREATE INDEX "shifts_status_idx" ON "shifts"("status");
CREATE INDEX "shifts_generation_batch_id_idx" ON "shifts"("generationBatchId");

ALTER TABLE "schedule_templates"
    ADD CONSTRAINT "schedule_templates_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
    ADD CONSTRAINT "schedule_templates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
    ADD CONSTRAINT "schedule_templates_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
    ADD CONSTRAINT "schedule_templates_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
    ADD CONSTRAINT "schedule_templates_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "schedule_templates"
    ADD CONSTRAINT "schedule_templates_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_generation_batches"
    ADD CONSTRAINT "shift_generation_batches_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_generation_batches"
    ADD CONSTRAINT "shift_generation_batches_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_generation_batches"
    ADD CONSTRAINT "shift_generation_batches_sourceTemplateId_fkey"
    FOREIGN KEY ("sourceTemplateId") REFERENCES "schedule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shift_generation_batches"
    ADD CONSTRAINT "shift_generation_batches_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_generationBatchId_fkey"
    FOREIGN KEY ("generationBatchId") REFERENCES "shift_generation_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_no_overlap_for_employee"
    EXCLUDE USING gist (
        "companyId" WITH =,
        "employeeId" WITH =,
        tsrange("scheduledStartUtc", "scheduledEndUtc", '[)') WITH &&
    )
    WHERE ("status" = 'SCHEDULED');
