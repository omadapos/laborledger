import type { VinDecodeResult } from "./vin-decode.types";

type NhtsaFlatRow = Record<string, string | undefined>;

function readField(row: NhtsaFlatRow, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function parseYear(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function buildNhtsaDecodeUrl(baseUrl: string, vin: string, modelYear?: number) {
  const normalizedBase = baseUrl.replace(/\/+$/u, "");
  const params = new URLSearchParams({ format: "json" });

  if (modelYear !== undefined) {
    params.set("modelyear", String(modelYear));
  }

  return `${normalizedBase}/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}?${params.toString()}`;
}

export function mapNhtsaVpicResponse(
  vin: string,
  payload: unknown,
  decodedAt: string
): VinDecodeResult {
  const body = payload as { Results?: NhtsaFlatRow[] };
  const row = body.Results?.[0] ?? {};

  const errorCode = readField(row, "ErrorCode", "Error Code");
  const errorText = readField(row, "ErrorText", "Error Text");

  const make = readField(row, "Make") ?? readField(row, "NCSAMake");
  const model = readField(row, "Model") ?? readField(row, "NCSAModel");

  return {
    vin,
    year: parseYear(readField(row, "ModelYear", "Model Year")),
    make,
    model,
    trim: readField(row, "Trim"),
    bodyClass: readField(row, "BodyClass", "Body Class") ?? readField(row, "NCSABodyType"),
    vehicleType: readField(row, "VehicleType", "Vehicle Type"),
    fuelType: readField(row, "FuelTypePrimary", "Fuel Type - Primary"),
    engineCylinders: readField(row, "EngineCylinders", "Engine Number of Cylinders"),
    displacementL: readField(row, "DisplacementL", "Displacement (L)"),
    manufacturer: readField(row, "Manufacturer", "Manufacturer Name"),
    plantCity: readField(row, "PlantCity", "Plant City"),
    plantState: readField(row, "PlantState", "Plant State"),
    plantCountry: readField(row, "PlantCountry", "Plant Country"),
    color: null,
    errorCode,
    errorText,
    source: "NHTSA_VPIC",
    decodedAt,
    rawPayload: payload
  };
}

export function collectNhtsaWarnings(result: Pick<VinDecodeResult, "errorCode" | "errorText">): string[] {
  if (!result.errorCode || result.errorCode === "0") {
    return [];
  }

  if (result.errorText) {
    return [result.errorText];
  }

  return [`NHTSA decode warning code ${result.errorCode}.`];
}
