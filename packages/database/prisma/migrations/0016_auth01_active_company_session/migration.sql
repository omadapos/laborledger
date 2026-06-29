-- AUTH01: persist active company on authenticated admin sessions
ALTER TABLE "sessions" ADD COLUMN "activeCompanyId" TEXT;

CREATE INDEX "sessions_active_company_id_idx" ON "sessions"("activeCompanyId");

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_activeCompanyId_fkey"
  FOREIGN KEY ("activeCompanyId") REFERENCES "companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
