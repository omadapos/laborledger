import type { CompanyRecord } from "./employee-utils";
import type { LocationRecord, ServiceClientRecord } from "./location-utils";

export type VehicleListRecord = {
  id: string;
  companyId: string;
  serviceClientId: string;
  locationId: string;
  vin: string;
  plate: string | null;
  color: string | null;
  mileage: number | null;
  notes: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  decodedAt: string | null;
  decodeSource: string | null;
  decodePayload: Record<string, unknown> | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  serviceClient: { id: string; name: string };
  location: { id: string; name: string; timezone: string; serviceClientId: string };
};

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateVin(value: string) {
  const normalized = normalizeVin(value);

  if (!normalized) {
    return "VIN is required.";
  }

  if (normalized.length !== 17) {
    return "VIN must be exactly 17 characters.";
  }

  if (!VIN_PATTERN.test(normalized)) {
    return "VIN must use letters and digits only (I, O, and Q are not allowed).";
  }

  return undefined;
}

export function formatVehicleTitle(vehicle: Pick<VehicleListRecord, "year" | "make" | "model" | "vin">) {
  const parts = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(" ");
  }

  return vehicle.vin;
}

export function formatVehicleDate(value?: string | null) {
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

export function vehicleIntakeDisclaimer() {
  return "VIN is required. Decoded data comes from the backend VIN decoder and is saved as a vehicle snapshot when you create the record. This does not create an invoice or payroll record.";
}

export type VinDecodePreviewRecord = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  bodyClass: string | null;
  vehicleType: string | null;
  fuelType: string | null;
  engineCylinders?: string | null;
  displacementL?: string | null;
  manufacturer?: string | null;
  plantCity?: string | null;
  plantState?: string | null;
  plantCountry?: string | null;
  decodeSource: string;
  decodedAt: string;
  warnings?: string[];
};

export function canDecodeVin(value: string) {
  return validateVin(value) === undefined;
}

export function formatVinDecodeSourceLabel(source: string) {
  if (source === "NHTSA_VPIC") {
    return "NHTSA vPIC";
  }

  if (source === "STUB") {
    return "Local stub decoder";
  }

  return source;
}

export function formatVinDecodeSummary(preview: VinDecodePreviewRecord) {
  const titleParts = [preview.year, preview.make, preview.model, preview.trim].filter(Boolean);
  const title =
    titleParts.length > 0
      ? titleParts.join(" ")
      : formatVehicleTitle({
          year: preview.year,
          make: preview.make,
          model: preview.model,
          vin: preview.vin
        });

  const details = [
    preview.bodyClass ? `Body: ${preview.bodyClass}` : null,
    preview.vehicleType ? `Type: ${preview.vehicleType}` : null,
    preview.fuelType ? `Fuel: ${preview.fuelType}` : null,
    preview.manufacturer ? `Manufacturer: ${preview.manufacturer}` : null,
    preview.plantCity || preview.plantState || preview.plantCountry
      ? `Plant: ${[preview.plantCity, preview.plantState, preview.plantCountry].filter(Boolean).join(", ")}`
      : null
  ].filter(Boolean);

  if (details.length === 0) {
    return title;
  }

  return `${title} · ${details.join(" · ")}`;
}

export function vinDecodePreviewLoadingCopy() {
  return "Decoding VIN…";
}

export function vinDecodeErrorCopy(message?: string) {
  return message ?? "Unable to decode this VIN right now. You can still enter manual fields and retry.";
}

export function vehiclesEmptyMessage(hasAnyVehicles: boolean) {
  if (hasAnyVehicles) {
    return {
      title: "No vehicles match your filters",
      description: "Try a different search, status, service client, or location filter."
    };
  }

  return {
    title: "No vehicles yet",
    description:
      "Create VIN-backed vehicle records tied to a service client and location. Enter a valid VIN to preview decoded data from the backend decoder before saving."
  };
}

export function parseOptionalMileageInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { mileage: undefined as number | undefined };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { error: "Mileage must be a whole number." as const };
  }

  const mileage = Number.parseInt(trimmed, 10);
  if (mileage < 0) {
    return { error: "Mileage must be zero or greater." as const };
  }

  return { mileage };
}

export function filterLocationsForClient(locations: LocationRecord[], serviceClientId: string) {
  return locations.filter(
    (location) => !location.archivedAt && location.serviceClientId === serviceClientId
  );
}

export function vehicleCreatePrerequisiteMessage(
  serviceClients: ServiceClientRecord[],
  locations: LocationRecord[]
): string | null {
  const activeClients = serviceClients.filter((client) => !client.archivedAt);

  if (activeClients.length === 0) {
    return "Add an active service client before creating vehicles.";
  }

  const hasActiveLocation = activeClients.some((client) =>
    locations.some(
      (location) => !location.archivedAt && location.serviceClientId === client.id
    )
  );

  if (!hasActiveLocation) {
    return "Add an active location for a service client before creating vehicles.";
  }

  return null;
}

export function canCreateVehicleIntake(
  serviceClients: ServiceClientRecord[],
  locations: LocationRecord[]
) {
  return vehicleCreatePrerequisiteMessage(serviceClients, locations) === null;
}

export function buildVehicleListQuery(options: {
  includeArchived: boolean;
  serviceClientId?: string;
  locationId?: string;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (options.includeArchived) {
    params.set("includeArchived", "true");
  }
  if (options.serviceClientId) {
    params.set("serviceClientId", options.serviceClientId);
  }
  if (options.locationId) {
    params.set("locationId", options.locationId);
  }
  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export type { CompanyRecord, LocationRecord, ServiceClientRecord };
