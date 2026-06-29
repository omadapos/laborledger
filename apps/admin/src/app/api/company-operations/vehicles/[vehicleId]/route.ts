import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    vehicleId: string;
  }>;
};

type UpdateVehicleBody = {
  serviceClientId?: string;
  locationId?: string;
  plate?: string | null;
  color?: string | null;
  mileage?: number | null;
  notes?: string | null;
};

export async function POST(request: Request, context: RouteContext) {
  const { vehicleId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateVehicleBody | null;

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

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/vehicles/${vehicleId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      serviceClientId: body.serviceClientId,
      locationId: body.locationId,
      plate: body.plate ?? null,
      color: body.color ?? null,
      mileage: body.mileage ?? null,
      notes: body.notes ?? null
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
      { message: formatApiMessage(responsePayload, "Unable to update vehicle.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      vehicle: {
        id: responsePayload.id ?? vehicleId,
        vin: responsePayload.vin
      }
    },
    { status: 201 }
  );
}
