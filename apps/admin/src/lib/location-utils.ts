import type { CompanyRecord } from "./employee-utils";

export type ServiceClientRecord = {
  id: string;
  name: string;
  archivedAt: string | null;
};

export type LocationRecord = {
  id: string;
  companyId: string;
  serviceClientId: string;
  name: string;
  timezone: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type LocationViewRecord = LocationRecord & {
  serviceClientName: string;
};

export const COMMON_IANA_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "UTC"
] as const;

export function isValidIanaTimeZone(timezone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone.trim() });
    return true;
  } catch {
    return false;
  }
}

export function validateLocationName(name: string) {
  if (!name.trim()) {
    return "Location name is required.";
  }

  return null;
}

export function validateLocationTimeZone(timezone: string) {
  const trimmed = timezone.trim();
  if (!trimmed) {
    return "Time zone is required.";
  }

  if (!isValidIanaTimeZone(trimmed)) {
    return "Time zone must be a valid IANA identifier (for example, America/New_York).";
  }

  return null;
}

export function validateServiceClientId(serviceClientId: string) {
  if (!serviceClientId) {
    return "Service client is required.";
  }

  return null;
}

export function formatLocationDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function filterLocationsByQuery(locations: LocationViewRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return locations;
  }

  return locations.filter(
    (location) =>
      location.name.toLowerCase().includes(normalized) ||
      location.timezone.toLowerCase().includes(normalized) ||
      location.serviceClientName.toLowerCase().includes(normalized)
  );
}

export function enrichLocations(
  locations: LocationRecord[],
  serviceClients: ServiceClientRecord[]
): LocationViewRecord[] {
  const clientNameById = new Map(serviceClients.map((client) => [client.id, client.name]));

  return locations.map((location) => ({
    ...location,
    serviceClientName: clientNameById.get(location.serviceClientId) ?? "Unknown client"
  }));
}

export type { CompanyRecord };
