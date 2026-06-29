import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    shiftId: string;
  }>;
};

type CancelShiftBody = {
  cancelReason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { shiftId } = await context.params;
  const body = (await request.json().catch(() => null)) as CancelShiftBody | null;
  const cancelReason = body?.cancelReason?.trim() ?? "";

  if (!cancelReason) {
    return NextResponse.json({ message: "Cancel reason is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/shifts/${shiftId}/cancel`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ cancelReason }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to cancel shift.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
