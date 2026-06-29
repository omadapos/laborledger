import { NextResponse } from "next/server";

import {
  callFieldLaborWorkBlock,
  fieldLaborWorkNotConfiguredMessage,
  isFieldLaborWorkConfigured
} from "@/lib/field-labor-work-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldLaborWorkConfigured()) {
    return NextResponse.json({ message: fieldLaborWorkNotConfiguredMessage() }, { status: 503 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { blockedReason?: string };
  const result = await callFieldLaborWorkBlock(auth.session, id, body.blockedReason ?? "");
  if (!result.ok) {
    return NextResponse.json(result.payload, { status: result.status });
  }

  return NextResponse.json(result.payload);
}
