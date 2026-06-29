import { NextResponse } from "next/server";

import { mapFieldClockStatus } from "@/lib/field-clock-utils";
import {
  callKioskLookup,
  fieldClockNotConfiguredMessage,
  isFieldClockConfigured
} from "@/lib/field-kiosk-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET() {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldClockConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: fieldClockNotConfiguredMessage()
      },
      { status: 503 }
    );
  }

  const result = await callKioskLookup(auth.session.pin);
  if (!result.ok) {
    return NextResponse.json(
      { message: result.payload.message ?? "Unable to load shift status." },
      { status: result.status }
    );
  }

  return NextResponse.json({
    configured: true,
    ...mapFieldClockStatus(result.payload)
  });
}
