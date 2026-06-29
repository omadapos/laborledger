import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const serviceClientId = url.searchParams.get("serviceClientId")?.trim() ?? "";
  if (!serviceClientId) {
    return NextResponse.json({ message: "Service client is required." }, { status: 400 });
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/invoiceable-work-orders?serviceClientId=${encodeURIComponent(serviceClientId)}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}
