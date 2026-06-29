import { NextResponse } from "next/server";

import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

type CompleteServiceBody = {
  pin?: string;
  notes?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ workOrderServiceLineId: string }> }
) {
  const { workOrderServiceLineId } = await context.params;
  const body = (await request.json().catch(() => null)) as CompleteServiceBody | null;
  const companyId = requireResolvedFieldCompanyId();

  if (!companyId) {
    return NextResponse.json({ message: fieldCompanyNotConfiguredMessage() }, { status: 503 });
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/worker/service-lines/${workOrderServiceLineId}/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId,
        pin: body?.pin ?? "",
        notes: body?.notes
      }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}
