import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type DecodeVinBody = {
  vin?: string;
  modelYear?: number;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DecodeVinBody | null;
  const vin = body?.vin?.trim() ?? "";

  if (!vin) {
    return NextResponse.json({ message: "VIN is required." }, { status: 400 });
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/vehicles/decode-vin`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({
      vin,
      ...(body?.modelYear !== undefined ? { modelYear: body.modelYear } : {})
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown> & {
    message?: string | string[];
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(payload, "Unable to decode VIN.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(payload, { status: apiResponse.status });
}
