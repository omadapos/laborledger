import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

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
  const query = url.searchParams.toString();
  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/companies/${companyId}/labor-pay-billing/client-billing-csv${query ? `?${query}` : ""}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store"
    }
  );

  if (!apiResponse.ok) {
    const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: apiResponse.status });
  }

  const buffer = await apiResponse.arrayBuffer();
  const contentDisposition =
    apiResponse.headers.get("content-disposition") ?? 'attachment; filename="client-labor-billing.csv"';

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition
    }
  });
}
