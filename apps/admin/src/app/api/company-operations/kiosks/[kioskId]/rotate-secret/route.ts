import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    kioskId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { kioskId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/kiosks/${kioskId}/rotate-secret`, {
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
    kioskId?: string;
    kioskSecret?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to rotate kiosk secret.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      kioskId: responsePayload.kioskId ?? kioskId,
      kioskSecret: responsePayload.kioskSecret
    },
    { status: 200 }
  );
}
