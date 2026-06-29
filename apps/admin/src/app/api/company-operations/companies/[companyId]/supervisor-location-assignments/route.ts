import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/supervisor-location-assignments`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load supervisor assignments.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: 200 });
}
