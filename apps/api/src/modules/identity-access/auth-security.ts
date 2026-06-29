import { createHash, randomBytes } from "node:crypto";

import { BadRequestException } from "@nestjs/common";

const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string) {
  const value = password ?? "";

  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (!/[A-Za-z]/u.test(value) || !/[0-9]/u.test(value)) {
    throw new BadRequestException("Password must include at least one letter and one number.");
  }
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSecureToken() {
  return randomBytes(32).toString("base64url");
}

export function resolveAdminAppUrl() {
  return (process.env.ADMIN_APP_URL ?? "http://localhost:3000").replace(/\/$/u, "");
}

export function resolveAuthFromIdentity() {
  const fromEmail = process.env.AUTH_FROM_EMAIL?.trim() || "noreply@laborledger.local";
  const fromName = process.env.AUTH_FROM_NAME?.trim() || "LaborLedger";
  return { fromEmail, fromName };
}
