import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    serviceCatalogItemId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { serviceCatalogItemId } = await context.params;

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/service-catalog/${serviceCatalogItemId}/unarchive`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to reactivate service catalog item.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
