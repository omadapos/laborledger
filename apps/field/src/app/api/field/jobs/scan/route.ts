import { NextResponse } from "next/server";

import { callWorkerScan, fieldJobsNotConfiguredMessage, isFieldJobsConfigured } from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type ScanBody = {
  workOrderId?: string;
  workOrderAssignmentId?: string;
  enteredVin?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured()) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as ScanBody | null;
  const workOrderId = body?.workOrderId?.trim() ?? "";
  const enteredVin = body?.enteredVin?.trim() ?? "";

  if (!workOrderId) {
    return NextResponse.json({ message: "Job is required." }, { status: 400 });
  }

  if (!enteredVin) {
    return NextResponse.json({ message: "VIN is required." }, { status: 400 });
  }

  const result = await callWorkerScan(auth.session, {
    workOrderId,
    workOrderAssignmentId: body?.workOrderAssignmentId?.trim() || undefined,
    enteredVin,
    idempotencyKey: body?.idempotencyKey
  });

  return NextResponse.json(result.payload, { status: result.status });
}
