import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export function formatApiMessage(payload: { message?: string | string[] }, fallback: string) {
  if (Array.isArray(payload.message)) {
    return payload.message.join(" ");
  }

  return payload.message ?? fallback;
}

export async function requireSessionCookie() {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader.includes("laborledger.sid=")) {
    return null;
  }

  return cookieHeader;
}

export function unauthorizedResponse() {
  return NextResponse.json({ message: "Authentication required." }, { status: 401 });
}
