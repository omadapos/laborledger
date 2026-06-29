import { NextResponse } from "next/server";

import { isFieldClockConfigured } from "@/lib/field-kiosk-client";
import { requireFieldSession } from "@/lib/field-route-auth";
import { toPublicFieldSession } from "@/lib/field-session";

export async function GET() {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  return NextResponse.json({
    session: toPublicFieldSession(auth.session),
    clockConfigured: isFieldClockConfigured()
  });
}
