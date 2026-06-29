/** Server-only adapter to internal kiosk punch API — never expose credentials to the browser. */

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const KIOSK_ID = process.env.KIOSK_ID?.trim() ?? "";
const KIOSK_SECRET = process.env.KIOSK_SECRET?.trim() ?? "";

export type KioskSessionPayload = {
  employeeName?: string;
  punchState?: string;
  allowedActions?: string[];
  warnings?: string[];
  workedMinutes?: number | null;
  duplicate?: boolean;
  message?: string;
  timezone?: string;
  scheduledStartUtc?: string;
  scheduledEndUtc?: string;
};

export function isFieldClockConfigured(): boolean {
  return KIOSK_ID.length > 0 && KIOSK_SECRET.length > 0;
}

export function fieldClockNotConfiguredMessage(): string {
  return "Clock is not available on this device. Ask your supervisor to configure the time clock.";
}

function kioskHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-kiosk-id": KIOSK_ID,
    "x-kiosk-secret": KIOSK_SECRET
  };
}

export async function callKioskLookup(pin: string): Promise<{ ok: boolean; status: number; payload: KioskSessionPayload }> {
  const apiResponse = await fetch(`${API_BASE_URL}/kiosk/lookup`, {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify({ pin }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as KioskSessionPayload;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callKioskPunch(input: {
  pin: string;
  action: string;
  idempotencyKey: string;
}): Promise<{ ok: boolean; status: number; payload: KioskSessionPayload }> {
  const apiResponse = await fetch(`${API_BASE_URL}/kiosk/punch`, {
    method: "POST",
    headers: kioskHeaders(),
    body: JSON.stringify(input),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as KioskSessionPayload;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}
