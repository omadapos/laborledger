import { NextResponse } from "next/server";

import { callWorkerCreateJob, fieldJobsNotConfiguredMessage, isFieldJobsConfigured } from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type CreateJobBody = {
  enteredVin?: string;
  serviceClientId?: string;
  locationId?: string;
  serviceCatalogItemId?: string;
  notes?: string;
};

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured()) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as CreateJobBody | null;
  const enteredVin = body?.enteredVin?.trim() ?? "";
  const serviceClientId = body?.serviceClientId?.trim() ?? "";
  const locationId = body?.locationId?.trim() ?? "";
  const serviceCatalogItemId = body?.serviceCatalogItemId?.trim() ?? "";

  if (!enteredVin || !serviceClientId || !locationId || !serviceCatalogItemId) {
    return NextResponse.json(
      { message: "VIN, customer, location, and service are required." },
      { status: 400 }
    );
  }

  const result = await callWorkerCreateJob(auth.session, {
    enteredVin,
    serviceClientId,
    locationId,
    serviceCatalogItemId,
    notes: body?.notes?.trim() || undefined
  });

  return NextResponse.json(result.payload, { status: result.status });
}
