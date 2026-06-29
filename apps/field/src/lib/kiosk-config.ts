/** Server-only kiosk env checks — never expose KIOSK_SECRET to the client. */

export function isKioskConfigured(): boolean {
  const kioskId = process.env.KIOSK_ID?.trim() ?? "";
  const kioskSecret = process.env.KIOSK_SECRET?.trim() ?? "";
  return kioskId.length > 0 && kioskSecret.length > 0;
}

export function getKioskDisplayId(): string | null {
  const kioskId = process.env.KIOSK_ID?.trim();
  return kioskId && kioskId.length > 0 ? kioskId : null;
}
