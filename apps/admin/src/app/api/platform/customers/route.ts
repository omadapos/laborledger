import { NextResponse } from "next/server";

import {
  API_BASE_URL,
  formatApiMessage,
  requireSessionCookie,
  unauthorizedResponse
} from "../../../../lib/api-bff";

type CreatePlatformCustomerBody = {
  customerName?: string;
  companyName?: string;
  ownerFullName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
};

export async function GET() {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/platform/customers`, {
    headers: {
      cookie: cookieHeader
    },
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}

export async function POST(request: Request) {
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const body = (await request.json().catch(() => null)) as CreatePlatformCustomerBody | null;

  const apiResponse = await fetch(`${API_BASE_URL}/platform/customers`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      customerName: body?.customerName?.trim() ?? "",
      companyName: body?.companyName?.trim() ?? "",
      ownerFullName: body?.ownerFullName?.trim() ?? "",
      ownerEmail: body?.ownerEmail?.trim().toLowerCase() ?? "",
      ownerPassword: body?.ownerPassword ?? ""
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown> & {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      {
        message: formatApiMessage(payload, "Unable to create customer account.")
      },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
