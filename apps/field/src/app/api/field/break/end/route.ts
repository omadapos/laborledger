import { NextResponse } from "next/server";

import { mapFieldClockStatus } from "@/lib/field-clock-utils";
import {
  callKioskPunch,
  fieldClockNotConfiguredMessage,
  isFieldClockConfigured
} from "@/lib/field-kiosk-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function POST(request: Request) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldClockConfigured()) {
    return NextResponse.json({ message: fieldClockNotConfiguredMessage() }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { idempotencyKey?: string } | null;
  const idempotencyKey = body?.idempotencyKey?.trim() ?? "";
  if (!idempotencyKey) {
    return NextResponse.json({ message: "idempotencyKey is required." }, { status: 400 });
  }

  const result = await callKioskPunch({
    pin: auth.session.pin,
    action: "break_end",
    idempotencyKey
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.payload.message ?? "End break was rejected." },
      { status: result.status }
    );
  }

  return NextResponse.json({
    duplicate: result.payload.duplicate ?? false,
    message: result.payload.duplicate ? "Duplicate request ignored." : "Break ended.",
    ...mapFieldClockStatus(result.payload)
  });
}
