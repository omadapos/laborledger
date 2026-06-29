import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const FIELD_SESSION_COOKIE = "laborledger.field.sid";
export const FIELD_SESSION_TTL_SECONDS = 60 * 60 * 8;

export type FieldSessionData = {
  employeeId: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  pin: string;
  issuedAt: number;
};

export type FieldSessionPublic = Omit<FieldSessionData, "pin">;

function getSessionSecret(): string {
  const secret =
    process.env.FIELD_SESSION_SECRET?.trim() ??
    process.env.KIOSK_SECRET?.trim() ??
    process.env.WORKER_COMPANY_ID?.trim() ??
    "";
  if (!secret) {
    throw new Error(
      "FIELD_SESSION_SECRET, KIOSK_SECRET, or WORKER_COMPANY_ID must be configured for Field sessions."
    );
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function encodeFieldSession(data: FieldSessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function decodeFieldSession(token: string): FieldSessionData | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as FieldSessionData;
    if (!data.employeeId || !data.companyId || !/^\d{6}$/u.test(data.pin ?? "")) {
      return null;
    }
    if (Date.now() - data.issuedAt > FIELD_SESSION_TTL_SECONDS * 1000) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function readFieldSession(): Promise<FieldSessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(FIELD_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return decodeFieldSession(token);
}

export function toPublicFieldSession(data: FieldSessionData): FieldSessionPublic {
  const { pin: _pin, ...publicSession } = data;
  return publicSession;
}

export function buildFieldSessionCookie(data: FieldSessionData) {
  return {
    name: FIELD_SESSION_COOKIE,
    value: encodeFieldSession(data),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FIELD_SESSION_TTL_SECONDS
  };
}

export function buildClearFieldSessionCookie() {
  return {
    name: FIELD_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  };
}
