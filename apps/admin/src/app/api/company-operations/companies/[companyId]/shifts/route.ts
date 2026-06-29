import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateShiftBody = {
  employeeId?: string;
  serviceClientId?: string;
  locationId?: string;
  scheduledStartUtc?: string;
  scheduledEndUtc?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateShiftBody | null;
  const employeeId = body?.employeeId?.trim() ?? "";
  const serviceClientId = body?.serviceClientId?.trim() ?? "";
  const locationId = body?.locationId?.trim() ?? "";
  const scheduledStartUtc = body?.scheduledStartUtc?.trim() ?? "";
  const scheduledEndUtc = body?.scheduledEndUtc?.trim() ?? "";

  if (!employeeId) {
    return NextResponse.json({ message: "Employee is required." }, { status: 400 });
  }

  if (!serviceClientId) {
    return NextResponse.json({ message: "Service client is required." }, { status: 400 });
  }

  if (!locationId) {
    return NextResponse.json({ message: "Location is required." }, { status: 400 });
  }

  if (!scheduledStartUtc) {
    return NextResponse.json({ message: "Scheduled start is required." }, { status: 400 });
  }

  if (!scheduledEndUtc) {
    return NextResponse.json({ message: "Scheduled end is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/shifts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      employeeId,
      serviceClientId,
      locationId,
      scheduledStartUtc,
      scheduledEndUtc
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to create shift.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ shift: { id: responsePayload.id } }, { status: 201 });
}
