import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

type UpdateWorkOrderBody = {
  notes?: string | null;
  status?: "DRAFT" | "READY";
};

export async function POST(request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateWorkOrderBody | null;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/work-orders/${workOrderId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      notes: body?.notes ?? null,
      status: body?.status
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    workOrderNumber?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to update work order.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      workOrder: {
        id: responsePayload.id ?? workOrderId,
        workOrderNumber: responsePayload.workOrderNumber
      }
    },
    { status: 201 }
  );
}
