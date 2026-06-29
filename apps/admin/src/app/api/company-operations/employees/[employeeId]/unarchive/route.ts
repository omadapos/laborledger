import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { employeeId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/employees/${employeeId}/unarchive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({}),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    fullName?: string;
    archivedAt?: string | null;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reactivate employee.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      employee: {
        id: responsePayload.id ?? employeeId,
        fullName: responsePayload.fullName,
        archivedAt: responsePayload.archivedAt ?? null
      }
    },
    { status: 200 }
  );
}
