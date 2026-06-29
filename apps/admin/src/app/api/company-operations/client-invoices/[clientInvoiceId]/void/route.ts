import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    clientInvoiceId: string;
  }>;
};

type VoidClientInvoiceBody = {
  voidReason?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { clientInvoiceId } = await context.params;
  const body = (await request.json().catch(() => null)) as VoidClientInvoiceBody | null;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/client-invoices/${clientInvoiceId}/void`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({ voidReason: body?.voidReason ?? "" }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as { message?: string | string[] };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to void invoice.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
