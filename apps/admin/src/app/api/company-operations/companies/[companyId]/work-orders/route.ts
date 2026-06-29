import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateWorkOrderBody = {
  vehicleId?: string;
  serviceCatalogItemIds?: string[];
  notes?: string;
  status?: "DRAFT" | "READY";
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateWorkOrderBody | null;

  if (!body?.vehicleId) {
    return NextResponse.json({ message: "Vehicle is required." }, { status: 400 });
  }

  if (!body.serviceCatalogItemIds || body.serviceCatalogItemIds.length === 0) {
    return NextResponse.json({ message: "At least one service catalog item is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/work-orders`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      vehicleId: body.vehicleId,
      serviceCatalogItemIds: body.serviceCatalogItemIds,
      notes: body.notes,
      status: body.status
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
      { message: formatApiMessage(responsePayload, "Unable to create work order.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      workOrder: {
        id: responsePayload.id,
        workOrderNumber: responsePayload.workOrderNumber
      }
    },
    { status: 201 }
  );
}
