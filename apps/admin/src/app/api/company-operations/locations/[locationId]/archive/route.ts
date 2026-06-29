import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    locationId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { locationId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/locations/${locationId}/archive`, {
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
    id?: string;
    name?: string;
    archivedAt?: string | null;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to deactivate location.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      location: {
        id: responsePayload.id ?? locationId,
        name: responsePayload.name,
        archivedAt: responsePayload.archivedAt ?? new Date().toISOString()
      }
    },
    { status: 200 }
  );
}
