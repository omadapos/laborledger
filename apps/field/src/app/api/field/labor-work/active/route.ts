import { NextResponse } from "next/server";

import {
  callFieldLaborWorkActive,
  fieldLaborWorkNotConfiguredMessage,
  isFieldLaborWorkConfigured
} from "@/lib/field-labor-work-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET() {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldLaborWorkConfigured()) {
    return NextResponse.json({ message: fieldLaborWorkNotConfiguredMessage() }, { status: 503 });
  }

  const result = await callFieldLaborWorkActive(auth.session);
  if (!result.ok) {
    return NextResponse.json(result.payload, { status: result.status });
  }

  return NextResponse.json(result.payload);
}
