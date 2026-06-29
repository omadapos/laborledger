import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CopyWeekBody = {
  sourceWeekStart?: string;
  targetWeekStart?: string;
  locationId?: string;
  employeeId?: string;
  serviceClientId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CopyWeekBody | null;
  const sourceWeekStart = body?.sourceWeekStart?.trim() ?? "";
  const targetWeekStart = body?.targetWeekStart?.trim() ?? "";

  if (!sourceWeekStart || !targetWeekStart) {
    return NextResponse.json({ message: "Source and target week starts are required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/shifts/copy-week`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      sourceWeekStart,
      targetWeekStart,
      locationId: body?.locationId?.trim() || undefined,
      employeeId: body?.employeeId?.trim() || undefined,
      serviceClientId: body?.serviceClientId?.trim() || undefined
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to copy week.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: apiResponse.status });
}
