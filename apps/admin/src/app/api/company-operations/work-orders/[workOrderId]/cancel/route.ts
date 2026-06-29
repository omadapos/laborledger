import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    workOrderId: string;
  }>;
};

type CancelWorkOrderBody = {
  cancelReason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { workOrderId } = await context.params;
  const body = (await request.json().catch(() => null)) as CancelWorkOrderBody | null;
  const cancelReason = body?.cancelReason?.trim() ?? "";

  if (!cancelReason) {
    return NextResponse.json({ message: "Cancel reason is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/work-orders/${workOrderId}/cancel`, {
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
    id?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to cancel work order.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ workOrder: { id: responsePayload.id ?? workOrderId } }, { status: 201 });
}
