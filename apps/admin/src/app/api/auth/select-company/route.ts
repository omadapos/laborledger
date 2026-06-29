import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie } from "../../../../lib/api-bff";

type SelectCompanyBody = {
  companyId?: string;
};

export async function POST(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as SelectCompanyBody | null;
  const companyId = body?.companyId?.trim() ?? "";

  if (!companyId) {
    return NextResponse.json({ message: "companyId is required." }, { status: 400 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/auth/select-company`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ companyId }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}
