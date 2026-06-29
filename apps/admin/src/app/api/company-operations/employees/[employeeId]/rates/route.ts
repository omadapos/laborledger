import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

type SetRateBody = {
  rateMinorUnits?: number;
  effectiveStart?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const { employeeId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/employees/${employeeId}/rates`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to load employee rates.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ rates: responsePayload }, { status: 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const { employeeId } = await context.params;
  const body = (await request.json().catch(() => null)) as SetRateBody | null;
  const rateMinorUnits = body?.rateMinorUnits;
  const effectiveStart = body?.effectiveStart ?? new Date().toISOString();

  if (typeof rateMinorUnits !== "number" || !Number.isFinite(rateMinorUnits) || rateMinorUnits <= 0) {
    return NextResponse.json({ message: "Hourly rate must be a positive amount." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/employees/${employeeId}/rates`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ rateMinorUnits, effectiveStart }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to set employee rate.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
