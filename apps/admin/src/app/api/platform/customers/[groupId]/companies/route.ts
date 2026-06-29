import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ groupId: string }>;
};

type CreatePlatformCompanyBody = {
  companyName?: string;
  adminFullName?: string;
  adminEmail?: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/platform/customers/${encodeURIComponent(groupId)}/companies`,
    {
      headers: {
        cookie: cookieHeader
      },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown> & {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      {
        message: formatApiMessage(payload, "Unable to load customer companies.")
      },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}

export async function POST(request: Request, context: RouteContext) {
  const { groupId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as CreatePlatformCompanyBody | null;

  const apiResponse = await fetch(`${API_BASE_URL}/groups/${encodeURIComponent(groupId)}/companies`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      name: body?.companyName?.trim() ?? "",
      adminEmail: body?.adminEmail?.trim().toLowerCase() ?? "",
      adminFullName: body?.adminFullName?.trim() ?? ""
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown> & {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      {
        message: formatApiMessage(payload, "Unable to create company.")
      },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
