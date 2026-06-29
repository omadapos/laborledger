import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/profile`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to load company profile.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: 200 });
}

type UpdateCompanyProfileBody = {
  legalName?: string | null;
  phone?: string | null;
  billingEmail?: string | null;
  primaryContactName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateRegion?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateCompanyProfileBody | null;

  if (!body) {
    return NextResponse.json({ message: "Request body is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${encodeURIComponent(companyId)}/profile`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to update company profile.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
