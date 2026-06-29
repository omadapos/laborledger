import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    weeklyPeriodId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { weeklyPeriodId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/weekly-periods/${weeklyPeriodId}/reopen`,
    {
      method: "POST",
      headers: { cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reopen the workweek.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
