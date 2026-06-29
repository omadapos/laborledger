import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    kioskId: string;
  }>;
};

type UpdateKioskBody = {
  name?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { kioskId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateKioskBody | null;
  const name = body?.name?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ message: "Kiosk name is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/kiosks/${kioskId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ name }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    name?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to update kiosk.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ kiosk: responsePayload }, { status: 200 });
}
