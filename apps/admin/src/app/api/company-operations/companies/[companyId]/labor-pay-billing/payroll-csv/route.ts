import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

function buildUpstreamUrl(companyId: string, request: Request, suffix: string) {
  const url = new URL(request.url);
  const query = url.searchParams.toString();
  return `${API_BASE_URL}/company-operations/companies/${companyId}/labor-pay-billing/${suffix}${query ? `?${query}` : ""}`;
}

async function proxyCsv(request: Request, context: RouteContext, suffix: string) {
  const { companyId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(buildUpstreamUrl(companyId, request, suffix), {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  if (!apiResponse.ok) {
    const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: apiResponse.status });
  }

  const buffer = await apiResponse.arrayBuffer();
  const contentDisposition =
    apiResponse.headers.get("content-disposition") ?? `attachment; filename="${suffix}.csv"`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition
    }
  });
}

export async function GET(request: Request, context: RouteContext) {
  return proxyCsv(request, context, "payroll-csv");
}
