import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie } from "../../../../lib/api-bff";

export async function GET() {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      cookie: cookieHeader
    },
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: apiResponse.status });
}
