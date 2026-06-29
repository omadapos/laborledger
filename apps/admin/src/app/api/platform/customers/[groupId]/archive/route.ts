import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

type LifecycleBody = {
  reason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as LifecycleBody;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/platform/customers/${encodeURIComponent(groupId)}/archive`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to archive customer.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
