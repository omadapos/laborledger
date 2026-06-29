import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie } from "../../../../lib/api-bff";

const SESSION_COOKIE_NAME = "laborledger.sid";

export async function POST() {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      cookie: cookieHeader
    },
    cache: "no-store"
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}
