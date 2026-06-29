import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/labor-pay-billing/drafts`,
    {
      method: "POST",
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: apiResponse.status });
}
