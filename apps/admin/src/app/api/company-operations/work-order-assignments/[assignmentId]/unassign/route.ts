import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    assignmentId: string;
  }>;
};

type UnassignWorkOrderBody = {
  unassignReason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { assignmentId } = await context.params;
  const body = (await request.json().catch(() => null)) as UnassignWorkOrderBody | null;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/work-order-assignments/${assignmentId}/unassign`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({
        ...(body?.unassignReason ? { unassignReason: body.unassignReason } : {})
      }),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to unassign employee.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ workOrder: responsePayload }, { status: 201 });
}
