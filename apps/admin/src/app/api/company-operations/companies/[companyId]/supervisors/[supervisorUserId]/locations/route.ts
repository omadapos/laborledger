import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string; supervisorUserId: string }>;
};

type AssignBody = {
  locationId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId, supervisorUserId } = await context.params;
  const body = (await request.json().catch(() => null)) as AssignBody | null;
  const locationId = body?.locationId?.trim() ?? "";

  if (!locationId) {
    return NextResponse.json({ message: "locationId is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({ locationId }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to assign supervisor to location.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
