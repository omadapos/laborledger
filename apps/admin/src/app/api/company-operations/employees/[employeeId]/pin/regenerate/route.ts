import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

type RegeneratePinBody = {
  pin?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { employeeId } = await context.params;
  const body = (await request.json().catch(() => null)) as RegeneratePinBody | null;
  const pin = body?.pin ?? "";

  if (!/^\d{6}$/u.test(pin)) {
    return NextResponse.json({ message: "Employee PIN must be exactly 6 digits." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/employees/${employeeId}/pin/regenerate`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({ pin }),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reset employee PIN.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
