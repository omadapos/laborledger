import { NextResponse } from "next/server";

import { API_BASE_URL, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    clientInvoiceId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { clientInvoiceId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/client-invoices/${clientInvoiceId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}
