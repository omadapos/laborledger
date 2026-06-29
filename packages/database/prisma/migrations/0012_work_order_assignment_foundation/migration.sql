-- AlterEnum
ALTER TYPE "WorkOrderStatus" ADD VALUE 'ASSIGNED';

-- CreateTable
CREATE TABLE "work_order_assignments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderServiceLineId" TEXT,
    "employeeId" TEXT NOT NULL,
    "roleLabel" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" TEXT,
    "unassignedAt" TIMESTAMP(3),
    "unassignedByUserId" TEXT,
    "unassignReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_responsibility_logs" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "vehicle_responsibility_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_order_assignments_group_id_idx" ON "work_order_assignments"("groupId");

-- CreateIndex
CREATE INDEX "work_order_assignments_company_id_idx" ON "work_order_assignments"("companyId");

-- CreateIndex
CREATE INDEX "work_order_assignments_work_order_id_idx" ON "work_order_assignments"("workOrderId");

-- CreateIndex
CREATE INDEX "work_order_assignments_work_order_service_line_id_idx" ON "work_order_assignments"("workOrderServiceLineId");

-- CreateIndex
CREATE INDEX "work_order_assignments_employee_id_idx" ON "work_order_assignments"("employeeId");

-- CreateIndex
CREATE INDEX "work_order_assignments_company_id_unassigned_at_idx" ON "work_order_assignments"("companyId", "unassignedAt");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_company_id_idx" ON "vehicle_responsibility_logs"("companyId");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_work_order_id_idx" ON "vehicle_responsibility_logs"("workOrderId");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_vehicle_id_idx" ON "vehicle_responsibility_logs"("vehicleId");

-- CreateIndex
CREATE INDEX "vehicle_responsibility_logs_employee_id_idx" ON "vehicle_responsibility_logs"("employeeId");

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_assignments" ADD CONSTRAINT "work_order_assignments_unassignedByUserId_fkey" FOREIGN KEY ("unassignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_responsibility_logs" ADD CONSTRAINT "vehicle_responsibility_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
