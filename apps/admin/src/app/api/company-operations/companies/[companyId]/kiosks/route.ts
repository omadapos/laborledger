import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateKioskBody = {
  name?: string;
  locationId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateKioskBody | null;
  const name = body?.name?.trim() ?? "";
  const locationId = body?.locationId ?? "";

  if (!name) {
    return NextResponse.json({ message: "Kiosk name is required." }, { status: 400 });
  }

  if (!locationId) {
    return NextResponse.json({ message: "Location is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/kiosks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ name, locationId }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    kiosk?: Record<string, unknown>;
    kioskSecret?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to create kiosk.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      kiosk: responsePayload.kiosk,
      kioskSecret: responsePayload.kioskSecret
    },
    { status: 201 }
  );
}
