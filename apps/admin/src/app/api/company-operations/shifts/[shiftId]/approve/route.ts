import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    shiftId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { shiftId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/shifts/${shiftId}/approve`, {
    method: "POST",
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to approve shift.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
