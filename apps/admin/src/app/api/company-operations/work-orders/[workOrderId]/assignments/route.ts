import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

type AssignWorkOrderBody = {
  employeeId?: string;
  workOrderServiceLineId?: string;
  roleLabel?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;
  const body = (await request.json().catch(() => null)) as AssignWorkOrderBody | null;
  const employeeId = body?.employeeId?.trim() ?? "";

  if (!employeeId) {
    return NextResponse.json({ message: "Employee is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/work-orders/${workOrderId}/assignments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      employeeId,
      ...(body?.workOrderServiceLineId ? { workOrderServiceLineId: body.workOrderServiceLineId } : {}),
      ...(body?.roleLabel ? { roleLabel: body.roleLabel } : {})
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to assign employee.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ workOrder: responsePayload }, { status: 201 });
}
