import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    shiftId: string;
  }>;
};

type UpdateShiftBody = {
  employeeId?: string;
  scheduledStartUtc?: string;
  scheduledEndUtc?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { shiftId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateShiftBody | null;
  const scheduledStartUtc = body?.scheduledStartUtc?.trim() ?? "";
  const scheduledEndUtc = body?.scheduledEndUtc?.trim() ?? "";

  if (!scheduledStartUtc || !scheduledEndUtc) {
    return NextResponse.json({ message: "Scheduled start and end are required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/shifts/${shiftId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      employeeId: body?.employeeId?.trim(),
      scheduledStartUtc,
      scheduledEndUtc
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    conflicts?: unknown[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      {
        message: formatApiMessage(responsePayload, "Unable to update shift."),
        conflicts: responsePayload.conflicts
      },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
