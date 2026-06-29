import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string; supervisorUserId: string; locationId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { companyId, supervisorUserId, locationId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations/${encodeURIComponent(locationId)}`,
    {
      method: "DELETE",
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to remove supervisor location assignment.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
