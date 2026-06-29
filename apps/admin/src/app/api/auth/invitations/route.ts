import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../lib/api-bff";

export async function GET(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId");

  if (!companyId) {
    return NextResponse.json({ message: "companyId is required." }, { status: 400 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/auth/invitations?companyId=${companyId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as { message?: string };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to load invitations.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: 200 });
}

export async function POST(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as {
    companyId?: string;
    email?: string;
    role?: string;
  };

  const apiResponse = await fetch(`${API_BASE_URL}/auth/invitations`, {
    method: "POST",
    headers: { cookie: cookieHeader, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as { message?: string };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to create invitation.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
