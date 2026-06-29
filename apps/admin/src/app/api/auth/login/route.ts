import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const SESSION_COOKIE_NAME = "laborledger.sid";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type LoginBody = {
  email?: string;
  password?: string;
};

function extractSessionToken(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) {
    return null;
  }

  const escapedCookieName = SESSION_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenMatch = setCookieHeader.match(new RegExp(`(?:^|,\\s*)${escapedCookieName}=([^;]+)`));

  if (!tokenMatch) {
    return null;
  }

  const encodedToken = tokenMatch[1];
  if (!encodedToken) {
    return null;
  }

  return decodeURIComponent(encodedToken);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const password = body?.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password are required." },
      { status: 400 }
    );
  }

  const apiResponse = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": request.headers.get("user-agent") ?? "laborledger-admin"
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string;
    user?: {
      id: string;
      email: string;
    };
    accessibleCompanyCount?: number;
    activeCompanyId?: string | null;
    redirectTo?: "dashboard" | "choose-company" | "blocked";
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      {
        message: responsePayload.message ?? "Invalid credentials."
      },
      { status: apiResponse.status }
    );
  }

  const sessionToken = extractSessionToken(apiResponse.headers.get("set-cookie"));

  if (!sessionToken) {
    return NextResponse.json(
      { message: "Login succeeded but no session cookie was returned." },
      { status: 502 }
    );
  }

  const response = NextResponse.json(
    {
      user: responsePayload.user,
      accessibleCompanyCount: responsePayload.accessibleCompanyCount ?? 0,
      activeCompanyId: responsePayload.activeCompanyId ?? null,
      redirectTo: responsePayload.redirectTo ?? "choose-company"
    },
    { status: 200 }
  );
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });

  return response;
}
