import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const KIOSK_ID = process.env.KIOSK_ID ?? "";
const KIOSK_SECRET = process.env.KIOSK_SECRET ?? "";

export async function POST(request: Request) {
  if (!KIOSK_ID || !KIOSK_SECRET) {
    return NextResponse.json(
      {
        message:
          "KIOSK_ID and KIOSK_SECRET must be set in the field app environment. Run pnpm seed:demo and copy the printed kiosk credentials."
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as {
    pin?: string;
    action?: string;
    idempotencyKey?: string;
  } | null;

  const apiResponse = await fetch(`${API_BASE_URL}/kiosk/punch`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-kiosk-id": KIOSK_ID,
      "x-kiosk-secret": KIOSK_SECRET
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;

  return NextResponse.json(payload, { status: apiResponse.status });
}
