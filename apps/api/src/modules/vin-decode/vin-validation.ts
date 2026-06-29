const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function normalizeVin(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function validateVin(value: string | null | undefined) {
  if (value === undefined || value === null || typeof value !== "string") {
    return { error: "VIN is required." as const };
  }

  const normalized = normalizeVin(value);

  if (!normalized) {
    return { error: "VIN is required." as const };
  }

  if (normalized.length !== 17) {
    return { error: "VIN must be exactly 17 characters." as const };
  }

  if (!VIN_PATTERN.test(normalized)) {
    return {
      error: "VIN must use letters and digits only (I, O, and Q are not allowed)." as const
    };
  }

  return { vin: normalized };
}
