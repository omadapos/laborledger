export type FieldJobCreateInput = {
  enteredVin?: string;
  serviceClientId?: string;
  locationId?: string;
  serviceCatalogItemId?: string;
  notes?: string;
};

export type FieldJobScopedRecord = {
  id: string;
  companyId: string;
  archivedAt?: Date | null;
  serviceClientId?: string;
};

export function validateFieldJobCreateInput(input: FieldJobCreateInput): string | null {
  if (!input.enteredVin?.trim()) {
    return "VIN is required.";
  }

  if (!input.serviceClientId?.trim()) {
    return "Customer is required.";
  }

  if (!input.locationId?.trim()) {
    return "Location is required.";
  }

  if (!input.serviceCatalogItemId?.trim()) {
    return "Service is required.";
  }

  return null;
}

export function assertServiceClientAllowed(
  serviceClient: FieldJobScopedRecord | null | undefined,
  companyId: string
): string | null {
  if (!serviceClient || serviceClient.archivedAt) {
    return "Customer not found for this company.";
  }

  if (serviceClient.companyId !== companyId) {
    return "Customer not found for this company.";
  }

  return null;
}

export function assertLocationAllowed(
  location: (FieldJobScopedRecord & { serviceClientId: string }) | null | undefined,
  companyId: string,
  serviceClientId: string
): string | null {
  if (!location || location.archivedAt) {
    return "Location not found for this company.";
  }

  if (location.companyId !== companyId) {
    return "Location not found for this company.";
  }

  if (location.serviceClientId !== serviceClientId) {
    return "Location does not belong to the selected customer.";
  }

  return null;
}

export function assertCatalogItemAllowed(
  catalogItem: FieldJobScopedRecord | null | undefined,
  companyId: string
): string | null {
  if (!catalogItem || catalogItem.archivedAt) {
    return "Service not found for this company.";
  }

  if (catalogItem.companyId !== companyId) {
    return "Service not found for this company.";
  }

  return null;
}

export function assertExistingVehicleMatchesSelection(input: {
  vehicle: { serviceClientId: string; locationId: string; archivedAt: Date | null } | null;
  serviceClientId: string;
  locationId: string;
}): string | null {
  if (!input.vehicle || input.vehicle.archivedAt) {
    return null;
  }

  if (
    input.vehicle.serviceClientId !== input.serviceClientId ||
    input.vehicle.locationId !== input.locationId
  ) {
    return "This VIN is already registered to a different customer or location.";
  }

  return null;
}
