-- PLATFORM02: SaaS customer (group) lifecycle status

CREATE TYPE "GroupStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

ALTER TABLE "groups"
  ADD COLUMN "status" "GroupStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspendedAt" TIMESTAMP(3),
  ADD COLUMN "suspendedByUserId" TEXT,
  ADD COLUMN "suspendedReason" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedByUserId" TEXT,
  ADD COLUMN "archivedReason" TEXT;

CREATE INDEX "groups_status_idx" ON "groups"("status");
