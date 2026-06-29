-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('MISSING_CLOCK_OUT', 'OPEN_BREAK_END', 'INCORRECT_CLOCK_IN', 'INCORRECT_CLOCK_OUT', 'INCORRECT_BREAK_START', 'INCORRECT_BREAK_END');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateTable
CREATE TABLE "correction_requests" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "type" "CorrectionType" NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "originalPayload" JSONB NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "finalPayload" JSONB,
    "requestedByUserId" TEXT,
    "requestedByEmployeeId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "correction_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_corrections" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "correctionRequestId" TEXT NOT NULL,
    "targetPunchEventId" TEXT,
    "action" "PunchAction" NOT NULL,
    "eventUtc" TIMESTAMP(3) NOT NULL,
    "breakMinutes" INTEGER,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "isEarly" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByUserId" TEXT NOT NULL,

    CONSTRAINT "punch_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correction_requests_company_id_idx" ON "correction_requests"("companyId");

-- CreateIndex
CREATE INDEX "correction_requests_shift_id_idx" ON "correction_requests"("shiftId");

-- CreateIndex
CREATE INDEX "correction_requests_status_idx" ON "correction_requests"("status");

-- CreateIndex
CREATE INDEX "correction_requests_created_at_idx" ON "correction_requests"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "punch_corrections_correctionRequestId_key" ON "punch_corrections"("correctionRequestId");

-- CreateIndex
CREATE INDEX "punch_corrections_shift_id_idx" ON "punch_corrections"("shiftId");

-- CreateIndex
CREATE INDEX "punch_corrections_company_id_idx" ON "punch_corrections"("companyId");

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_correctionRequestId_fkey" FOREIGN KEY ("correctionRequestId") REFERENCES "correction_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_targetPunchEventId_fkey" FOREIGN KEY ("targetPunchEventId") REFERENCES "punch_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_corrections" ADD CONSTRAINT "punch_corrections_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
