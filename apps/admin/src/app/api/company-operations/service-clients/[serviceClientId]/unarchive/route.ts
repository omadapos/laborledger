import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    serviceClientId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { serviceClientId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/service-clients/${serviceClientId}/unarchive`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({}),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    name?: string;
    archivedAt?: string | null;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reactivate service client.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      serviceClient: {
        id: responsePayload.id ?? serviceClientId,
        name: responsePayload.name,
        archivedAt: null
      }
    },
    { status: 200 }
  );
}
