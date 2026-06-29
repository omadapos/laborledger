-- CreateEnum
CREATE TYPE "LaborWorkAssignmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LaborWorkProgressStatus" AS ENUM ('STARTED', 'PREP_IN_PROGRESS', 'WASH_IN_PROGRESS', 'ALMOST_DONE', 'COMPLETED', 'BLOCKED');

-- CreateTable
CREATE TABLE "labor_work_assignments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "serviceCatalogItemId" TEXT,
    "vehicleId" TEXT,
    "vinSnapshot" TEXT,
    "employeeNameSnapshot" TEXT NOT NULL,
    "clientNameSnapshot" TEXT NOT NULL,
    "locationNameSnapshot" TEXT NOT NULL,
    "addressSnapshot" TEXT NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "status" "LaborWorkAssignmentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "progressStatus" "LaborWorkProgressStatus",
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "referencePrepStartedAt" TIMESTAMP(3),
    "referencePrepCompletedAt" TIMESTAMP(3),
    "referenceWashStartedAt" TIMESTAMP(3),
    "referenceWashCompletedAt" TIMESTAMP(3),
    "referenceServiceMinutes" INTEGER,
    "referencePrepMinutes" INTEGER,
    "referenceWashMinutes" INTEGER,
    "notes" TEXT,
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labor_work_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "labor_work_assignments_group_id_idx" ON "labor_work_assignments"("groupId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_company_id_idx" ON "labor_work_assignments"("companyId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_employee_id_idx" ON "labor_work_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_shift_id_idx" ON "labor_work_assignments"("shiftId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_service_client_id_idx" ON "labor_work_assignments"("serviceClientId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_location_id_idx" ON "labor_work_assignments"("locationId");

-- CreateIndex
CREATE INDEX "labor_work_assignments_status_idx" ON "labor_work_assignments"("status");

-- CreateIndex
CREATE INDEX "labor_work_assignments_started_at_idx" ON "labor_work_assignments"("startedAt");

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "service_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labor_work_assignments" ADD CONSTRAINT "labor_work_assignments_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
