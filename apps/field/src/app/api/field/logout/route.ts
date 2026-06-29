import { NextResponse } from "next/server";

import { buildClearFieldSessionCookie } from "@/lib/field-session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(buildClearFieldSessionCookie());
  return response;
}
