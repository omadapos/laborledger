import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateVehicleBody = {
  vin?: string;
  serviceClientId?: string;
  locationId?: string;
  plate?: string;
  color?: string;
  mileage?: number;
  notes?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateVehicleBody | null;
  const vin = body?.vin?.trim() ?? "";

  if (!vin) {
    return NextResponse.json({ message: "VIN is required." }, { status: 400 });
  }

  if (!body?.serviceClientId) {
    return NextResponse.json({ message: "Service client is required." }, { status: 400 });
  }

  if (!body?.locationId) {
    return NextResponse.json({ message: "Location is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/vehicles`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      vin,
      serviceClientId: body.serviceClientId,
      locationId: body.locationId,
      plate: body.plate,
      color: body.color,
      mileage: body.mileage,
      notes: body.notes
    }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    vin?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to create vehicle.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      vehicle: {
        id: responsePayload.id,
        vin: responsePayload.vin ?? vin.toUpperCase()
      }
    },
    { status: 201 }
  );
}
