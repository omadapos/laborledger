-- AlterTable
ALTER TABLE "shifts" ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedByUserId" TEXT,
ADD COLUMN "additionalTimeApprovedAt" TIMESTAMP(3),
ADD COLUMN "additionalTimeApprovedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "shifts_approved_at_idx" ON "shifts"("approvedAt");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_additionalTimeApprovedByUserId_fkey" FOREIGN KEY ("additionalTimeApprovedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
