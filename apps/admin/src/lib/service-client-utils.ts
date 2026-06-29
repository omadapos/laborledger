import type { CompanyRecord } from "./employee-utils";

export type ServiceClientListRecord = {
  id: string;
  companyId: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
};

export type ServiceClientViewRecord = ServiceClientListRecord & {
  locationCount: number;
};

export type LocationCountSource = {
  serviceClientId: string;
  archivedAt: string | null;
};

export function validateServiceClientName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Service client name is required.";
  }

  return undefined;
}

export function formatServiceClientDate(value?: string | null) {
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

export function filterServiceClientsByQuery(clients: ServiceClientViewRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return clients;
  }

  return clients.filter((client) => client.name.toLowerCase().includes(normalized));
}

export function enrichServiceClientsWithLocationCounts(
  clients: ServiceClientListRecord[],
  locations: LocationCountSource[]
): ServiceClientViewRecord[] {
  const activeLocationCounts = new Map<string, number>();

  for (const location of locations) {
    if (location.archivedAt) {
      continue;
    }

    activeLocationCounts.set(
      location.serviceClientId,
      (activeLocationCounts.get(location.serviceClientId) ?? 0) + 1
    );
  }

  return clients.map((client) => ({
    ...client,
    locationCount: activeLocationCounts.get(client.id) ?? 0
  }));
}

export type { CompanyRecord };
