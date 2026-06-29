import { NextResponse } from "next/server";

import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

type ScanBody = {
  pin?: string;
  workOrderId?: string;
  workOrderAssignmentId?: string;
  enteredVin?: string;
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ScanBody | null;
  const companyId = requireResolvedFieldCompanyId();

  if (!companyId) {
    return NextResponse.json({ message: fieldCompanyNotConfiguredMessage() }, { status: 503 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyId,
      pin: body?.pin ?? "",
      workOrderId: body?.workOrderId ?? "",
      workOrderAssignmentId: body?.workOrderAssignmentId,
      enteredVin: body?.enteredVin ?? "",
      idempotencyKey: body?.idempotencyKey
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}
