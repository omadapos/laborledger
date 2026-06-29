import { NextResponse } from "next/server";

import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const companyId = requireResolvedFieldCompanyId();

  if (!companyId) {
    return NextResponse.json({ message: fieldCompanyNotConfiguredMessage() }, { status: 503 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/lookup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId, pin: body?.pin ?? "" }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  if (!apiResponse.ok) {
    return NextResponse.json(payload, { status: apiResponse.status });
  }

  const employee = payload.employee as { fullName?: string } | undefined;
  const company = payload.company as { name?: string } | undefined;

  return NextResponse.json({
    employeeName: employee?.fullName,
    companyName: company?.name,
    assignments: payload.assignments
  });
}
