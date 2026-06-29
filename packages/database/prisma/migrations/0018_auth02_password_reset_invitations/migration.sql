-- AUTH02 password reset and company admin invitation foundation

CREATE TYPE "InvitationKind" AS ENUM ('ONBOARDING', 'COMPANY_ADMIN_ACCESS');

ALTER TABLE "invitations"
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "kind" "InvitationKind" NOT NULL DEFAULT 'ONBOARDING';

CREATE INDEX "invitations_company_id_idx" ON "invitations"("companyId");
CREATE INDEX "invitations_kind_idx" ON "invitations"("kind");

CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requesterIp" TEXT,
  "userAgent" TEXT,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("tokenHash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("userId");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expiresAt");

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
