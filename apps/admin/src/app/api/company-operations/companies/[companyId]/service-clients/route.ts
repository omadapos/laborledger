import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

type CreateServiceClientBody = {
  name?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateServiceClientBody | null;
  const name = body?.name?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ message: "Service client name is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/service-clients`, {
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
      { message: formatApiMessage(responsePayload, "Unable to create service client.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      serviceClient: {
        id: responsePayload.id,
        name: responsePayload.name ?? name
      }
    },
    { status: 201 }
  );
}
