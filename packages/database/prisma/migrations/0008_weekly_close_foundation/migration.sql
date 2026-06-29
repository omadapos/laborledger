-- CreateEnum
CREATE TYPE "WeeklyPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'REOPENED');

-- CreateTable
CREATE TABLE "weekly_periods" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "weekStartLocalDate" TEXT NOT NULL,
    "weekEndLocalDate" TEXT NOT NULL,
    "closeTimeZone" TEXT NOT NULL,
    "targetPayDate" TEXT NOT NULL,
    "status" "WeeklyPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedByUserId" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_close_snapshots" (
    "id" TEXT NOT NULL,
    "weeklyPeriodId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotPayload" JSONB NOT NULL,
    "approvedShiftCount" INTEGER NOT NULL,
    "payableMinutes" INTEGER NOT NULL,
    "employeeGrossEstimateMinor" INTEGER NOT NULL,
    "clientLaborEstimateMinor" INTEGER NOT NULL,
    "grossMarginEstimateMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,

    CONSTRAINT "weekly_close_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "weekly_periods_company_id_idx" ON "weekly_periods"("companyId");

-- CreateIndex
CREATE INDEX "weekly_periods_status_idx" ON "weekly_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_periods_company_id_week_start_key" ON "weekly_periods"("companyId", "weekStartLocalDate");

-- CreateIndex
CREATE INDEX "weekly_close_snapshots_period_id_idx" ON "weekly_close_snapshots"("weeklyPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_close_snapshots_period_version_key" ON "weekly_close_snapshots"("weeklyPeriodId", "version");

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_periods" ADD CONSTRAINT "weekly_periods_reopenedByUserId_fkey" FOREIGN KEY ("reopenedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_close_snapshots" ADD CONSTRAINT "weekly_close_snapshots_weeklyPeriodId_fkey" FOREIGN KEY ("weeklyPeriodId") REFERENCES "weekly_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_close_snapshots" ADD CONSTRAINT "weekly_close_snapshots_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
