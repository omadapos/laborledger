-- CreateTable
CREATE TABLE "worker_scan_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderAssignmentId" TEXT,
    "employeeId" TEXT NOT NULL,
    "enteredVin" TEXT NOT NULL,
    "matchedVin" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "deviceLabel" TEXT,
    "idempotencyKey" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worker_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "worker_scan_events_idempotency_key_key" ON "worker_scan_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "worker_scan_events_company_id_idx" ON "worker_scan_events"("companyId");

-- CreateIndex
CREATE INDEX "worker_scan_events_location_id_idx" ON "worker_scan_events"("locationId");

-- CreateIndex
CREATE INDEX "worker_scan_events_vehicle_id_idx" ON "worker_scan_events"("vehicleId");

-- CreateIndex
CREATE INDEX "worker_scan_events_work_order_id_idx" ON "worker_scan_events"("workOrderId");

-- CreateIndex
CREATE INDEX "worker_scan_events_employee_id_idx" ON "worker_scan_events"("employeeId");

-- CreateIndex
CREATE INDEX "worker_scan_events_work_order_assignment_id_idx" ON "worker_scan_events"("workOrderAssignmentId");

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_workOrderAssignmentId_fkey" FOREIGN KEY ("workOrderAssignmentId") REFERENCES "work_order_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worker_scan_events" ADD CONSTRAINT "worker_scan_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
