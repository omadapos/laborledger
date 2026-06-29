import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    serviceCatalogItemId: string;
  }>;
};

type UpdateServiceCatalogItemBody = {
  name?: string;
  description?: string | null;
  category?: string | null;
  fixedPriceMinor?: number;
  currencyCode?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const { serviceCatalogItemId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateServiceCatalogItemBody | null;
  const name = body?.name?.trim() ?? "";

  if (!name) {
    return NextResponse.json({ message: "Service name is required." }, { status: 400 });
  }

  if (body?.fixedPriceMinor === undefined || !Number.isInteger(body.fixedPriceMinor) || body.fixedPriceMinor <= 0) {
    return NextResponse.json(
      { message: "Fixed service price must be a positive integer in minor units." },
      { status: 400 }
    );
  }

  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/company-operations/service-catalog/${serviceCatalogItemId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader
      },
      body: JSON.stringify({
        name,
        description: body?.description ?? null,
        category: body?.category ?? null,
        fixedPriceMinor: body.fixedPriceMinor,
        currencyCode: body?.currencyCode
      }),
      cache: "no-store"
    }
  );

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    name?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to update service catalog item.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      serviceCatalogItem: {
        id: responsePayload.id ?? serviceCatalogItemId,
        name: responsePayload.name ?? name
      }
    },
    { status: 201 }
  );
}
