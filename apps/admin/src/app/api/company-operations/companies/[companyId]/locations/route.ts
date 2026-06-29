import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateLocationBody = {
  name?: string;
  timezone?: string;
  serviceClientId?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateLocationBody | null;
  const name = body?.name?.trim() ?? "";
  const timezone = body?.timezone?.trim() ?? "";
  const serviceClientId = body?.serviceClientId ?? "";

  if (!name) {
    return NextResponse.json({ message: "Location name is required." }, { status: 400 });
  }

  if (!timezone) {
    return NextResponse.json({ message: "Time zone is required." }, { status: 400 });
  }

  if (!serviceClientId) {
    return NextResponse.json({ message: "Service client is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/locations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ name, timezone, serviceClientId }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    name?: string;
    timezone?: string;
    serviceClientId?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to create location.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      location: {
        id: responsePayload.id,
        name: responsePayload.name,
        timezone: responsePayload.timezone,
        serviceClientId: responsePayload.serviceClientId
      }
    },
    { status: 201 }
  );
}
