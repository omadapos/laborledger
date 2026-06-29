-- AlterEnum
ALTER TYPE "WorkOrderStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "WorkOrderStatus" ADD VALUE 'COMPLETED';

-- CreateTable
CREATE TABLE "service_completions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderServiceLineId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workOrderAssignmentId" TEXT,
    "workerScanEventId" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedBySource" TEXT NOT NULL DEFAULT 'worker',
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_completions_company_id_idx" ON "service_completions"("companyId");

-- CreateIndex
CREATE INDEX "service_completions_work_order_id_idx" ON "service_completions"("workOrderId");

-- CreateIndex
CREATE INDEX "service_completions_work_order_service_line_id_idx" ON "service_completions"("workOrderServiceLineId");

-- CreateIndex
CREATE INDEX "service_completions_employee_id_idx" ON "service_completions"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "service_completions_active_line_key" ON "service_completions"("workOrderServiceLineId") WHERE "voidedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workOrderAssignmentId_fkey" FOREIGN KEY ("workOrderAssignmentId") REFERENCES "work_order_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_workerScanEventId_fkey" FOREIGN KEY ("workerScanEventId") REFERENCES "worker_scan_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_completions" ADD CONSTRAINT "service_completions_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
