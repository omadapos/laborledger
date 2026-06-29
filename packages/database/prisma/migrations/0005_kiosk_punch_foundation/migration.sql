-- CreateEnum
CREATE TYPE "PunchAction" AS ENUM ('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT');

-- CreateTable
CREATE TABLE "kiosks" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kiosks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kiosk_credentials" (
    "id" TEXT NOT NULL,
    "kioskId" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "kiosk_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_events" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kioskId" TEXT NOT NULL,
    "action" "PunchAction" NOT NULL,
    "eventUtc" TIMESTAMP(3) NOT NULL,
    "serverReceivedUtc" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT NOT NULL,
    "deviceEventId" TEXT,
    "deviceTimestamp" TIMESTAMP(3),
    "sequence" INTEGER,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "breakMinutes" INTEGER,

    CONSTRAINT "punch_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosks_location_id_key" ON "kiosks"("locationId");

-- CreateIndex
CREATE INDEX "kiosks_group_id_idx" ON "kiosks"("groupId");

-- CreateIndex
CREATE INDEX "kiosks_company_id_idx" ON "kiosks"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_credentials_kiosk_id_key" ON "kiosk_credentials"("kioskId");

-- CreateIndex
CREATE UNIQUE INDEX "punch_events_idempotency_key_key" ON "punch_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "punch_events_shift_id_idx" ON "punch_events"("shiftId");

-- CreateIndex
CREATE INDEX "punch_events_employee_id_idx" ON "punch_events"("employeeId");

-- CreateIndex
CREATE INDEX "punch_events_kiosk_id_idx" ON "punch_events"("kioskId");

-- CreateIndex
CREATE INDEX "punch_events_event_utc_idx" ON "punch_events"("eventUtc");

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kiosk_credentials" ADD CONSTRAINT "kiosk_credentials_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "kiosks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_kioskId_fkey" FOREIGN KEY ("kioskId") REFERENCES "kiosks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
