import { NextResponse } from "next/server";

import {
  callWorkerJobOptions,
  fieldJobsNotConfiguredMessage,
  isFieldJobsConfigured
} from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET() {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured()) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const result = await callWorkerJobOptions(auth.session);
  if (!result.ok) {
    return NextResponse.json(result.payload, { status: result.status });
  }

  const payload = result.payload as {
    serviceClients?: Array<{ id: string; name: string }>;
    locations?: Array<{ id: string; name: string; serviceClientId: string }>;
    serviceCatalogItems?: Array<{ id: string; name: string; category: string | null }>;
  };

  return NextResponse.json({
    serviceClients: payload.serviceClients ?? [],
    locations: payload.locations ?? [],
    serviceCatalogItems: payload.serviceCatalogItems ?? []
  });
}
