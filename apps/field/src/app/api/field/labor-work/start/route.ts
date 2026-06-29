import { NextResponse } from "next/server";

import {
  callFieldLaborWorkStart,
  fieldLaborWorkNotConfiguredMessage,
  isFieldLaborWorkConfigured
} from "@/lib/field-labor-work-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldLaborWorkConfigured()) {
    return NextResponse.json({ message: fieldLaborWorkNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    serviceClientId?: string;
    locationId?: string;
    serviceCatalogItemId?: string;
    vehicleId?: string;
    vin?: string;
    notes?: string;
  };

  const result = await callFieldLaborWorkStart(auth.session, {
    serviceClientId: body.serviceClientId ?? "",
    locationId: body.locationId ?? "",
    serviceCatalogItemId: body.serviceCatalogItemId ?? "",
    vehicleId: body.vehicleId,
    vin: body.vin,
    notes: body.notes
  });

  if (!result.ok) {
    return NextResponse.json(result.payload, { status: result.status });
  }

  return NextResponse.json(result.payload);
}
