import type { CompanyRecord } from "./employee-utils";

export type KioskRecord = {
  id: string;
  name: string;
  companyId: string;
  locationId: string;
  locationName: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  credentialStatus: "active" | "revoked" | "missing";
  credentialCreatedAt: string | null;
};

export type LocationOption = {
  id: string;
  name: string;
  archivedAt: string | null;
};

export const KIOSK_SECRET_HELPER =
  "Kiosk secrets are shown only once when created or rotated. Store them securely in the kiosk deployment environment.";

export function validateKioskName(name: string) {
  if (!name.trim()) {
    return "Kiosk name is required.";
  }

  return null;
}

export function validateKioskLocationId(locationId: string) {
  if (!locationId) {
    return "Location is required.";
  }

  return null;
}

export function formatKioskDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function credentialStatusLabel(status: KioskRecord["credentialStatus"]) {
  if (status === "active") {
    return "Active credential";
  }

  if (status === "revoked") {
    return "Revoked credential";
  }

  return "No credential";
}

export function filterKiosksByQuery(kiosks: KioskRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return kiosks;
  }

  return kiosks.filter((kiosk) => {
    return (
      kiosk.name.toLowerCase().includes(normalized) ||
      kiosk.locationName.toLowerCase().includes(normalized)
    );
  });
}

export function formatKioskEnvBlock(input: {
  kioskId: string;
  kioskSecret: string;
  apiUrl: string;
}) {
  return [
    `KIOSK_ID=${input.kioskId}`,
    `KIOSK_SECRET=${input.kioskSecret}`,
    `API_BASE_URL=${input.apiUrl}`
  ].join("\n");
}

export function locationsAvailableForKiosk(
  locations: LocationOption[],
  kiosks: KioskRecord[],
  editingKioskId?: string
) {
  const occupiedLocationIds = new Set(
    kiosks
      .filter((kiosk) => !kiosk.archivedAt && kiosk.id !== editingKioskId)
      .map((kiosk) => kiosk.locationId)
  );

  return locations.filter((location) => !location.archivedAt && !occupiedLocationIds.has(location.id));
}

export type { CompanyRecord };
