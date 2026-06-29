import type { LocationRecord, ServiceClientRecord } from "./location-utils";
import {
  canCreateVehicleIntake,
  normalizeVin,
  validateVin,
  type VinDecodePreviewRecord
} from "./vehicle-utils";
import { formatVehicleTitle } from "./vehicle-utils";

export const RECEPTION_PAGE_TITLE = "Reception";
export const RECEPTION_PAGE_DESCRIPTION =
  "Receive a vehicle, decode the VIN, select services, and create a work order for the active company.";
export const RECEPTION_HELPER_COPY =
  "This flow creates a vehicle record and a company job in one step. It does not issue invoices, assign workers, or process payments.";
export const RECEPTION_SUPERVISOR_BLOCKED_LINE_1 =
  "Reception is available to company admins and group owners.";
export const RECEPTION_SUPERVISOR_BLOCKED_LINE_2 =
  "Supervisors can review assigned-location jobs from the Jobs page, but they cannot receive vehicles or create work orders.";
export const RECEPTION_GO_TO_JOBS_CTA = "Go to Jobs";

/** @deprecated Use RECEPTION_SUPERVISOR_BLOCKED_LINE_1 + LINE_2 */
export const RECEPTION_SUPERVISOR_BLOCKED_COPY = `${RECEPTION_SUPERVISOR_BLOCKED_LINE_1} ${RECEPTION_SUPERVISOR_BLOCKED_LINE_2}`;

export function isReceptionBlockedForSupervisor(canManageCompany: boolean) {
  return !canManageCompany;
}

export type ReceptionFormState = {
  serviceClientId: string;
  locationId: string;
  vin: string;
  plate: string;
  color: string;
  notes: string;
  selectedCatalogIds: string[];
  workOrderNotes: string;
};

export function receptionRoute() {
  return "/reception";
}

export function jobsRoute() {
  return "/jobs";
}

export function jobDetailRoute(workOrderId: string) {
  return `/jobs/${encodeURIComponent(workOrderId)}`;
}

export function canOpenReception(
  serviceClients: ServiceClientRecord[],
  locations: LocationRecord[],
  canManageCompany: boolean
) {
  return canManageCompany && canCreateVehicleIntake(serviceClients, locations);
}

export function buildReceptionVehiclePayload(form: ReceptionFormState) {
  return {
    vin: normalizeVin(form.vin),
    serviceClientId: form.serviceClientId,
    locationId: form.locationId,
    plate: form.plate.trim() || undefined,
    color: form.color.trim() || undefined,
    notes: form.notes.trim() || undefined
  };
}

export function buildReceptionWorkOrderPayload(vehicleId: string, form: ReceptionFormState) {
  return {
    vehicleId,
    serviceCatalogItemIds: form.selectedCatalogIds,
    status: "READY" as const,
    notes: form.workOrderNotes.trim() || undefined
  };
}

export function formatDecodedVehicleSummary(
  decode: VinDecodePreviewRecord | Pick<VinDecodePreviewRecord, "year" | "make" | "model" | "trim" | "vin">
) {
  const title = formatVehicleTitle({
    year: decode.year,
    make: decode.make,
    model: decode.model,
    vin: decode.vin
  });

  if (decode.trim) {
    return `${title} · ${decode.trim}`;
  }

  return title;
}

export function validateReceptionForm(
  form: ReceptionFormState,
  options: { activeCatalogCount: number }
): Partial<Record<keyof ReceptionFormState | "selectedCatalogIds", string>> {
  const errors: Partial<Record<keyof ReceptionFormState | "selectedCatalogIds", string>> = {};

  const vinError = validateVin(form.vin);
  if (vinError) {
    errors.vin = vinError;
  }

  if (!form.serviceClientId) {
    errors.serviceClientId = "Service client is required.";
  }

  if (!form.locationId) {
    errors.locationId = "Location is required.";
  }

  if (form.selectedCatalogIds.length === 0) {
    errors.selectedCatalogIds = "Select at least one service.";
  }

  if (options.activeCatalogCount === 0) {
    errors.selectedCatalogIds = "Add active catalog services before receiving vehicles.";
  }

  return errors;
}

export function normalizeVinDisplay(value: string) {
  return normalizeVin(value);
}
