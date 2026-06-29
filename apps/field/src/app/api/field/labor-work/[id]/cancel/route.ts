import { NextResponse } from "next/server";

import {
  callFieldLaborWorkCancel,
  fieldLaborWorkNotConfiguredMessage,
  isFieldLaborWorkConfigured
} from "@/lib/field-labor-work-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, { params }: RouteParams) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldLaborWorkConfigured()) {
    return NextResponse.json({ message: fieldLaborWorkNotConfiguredMessage() }, { status: 503 });
  }

  const { id } = await params;
  const result = await callFieldLaborWorkCancel(auth.session, id);
  if (!result.ok) {
    return NextResponse.json(result.payload, { status: result.status });
  }

  return NextResponse.json(result.payload);
}
