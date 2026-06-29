import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = { params: Promise<{ correctionId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { correctionId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { reviewReason?: string };
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) return unauthorizedResponse();

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/corrections/${correctionId}/reject`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieHeader },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };
  if (!apiResponse.ok) {
    return NextResponse.json({ message: formatApiMessage(payload, "Unable to reject correction.") }, { status: apiResponse.status });
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
