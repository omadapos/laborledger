import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/platform/customers/${encodeURIComponent(groupId)}/reactivate`,
    {
      method: "POST",
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to reactivate customer.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
