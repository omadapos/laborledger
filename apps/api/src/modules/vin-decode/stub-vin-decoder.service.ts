import { Injectable } from "@nestjs/common";

import type { VinDecodeResult, VinDecoder } from "./vin-decode.types";
import { normalizeVin } from "./vin-validation";

/** Deterministic stub mappings for tests and local dev — not a government API. */
const KNOWN_VINS: Record<
  string,
  Omit<VinDecodeResult, "vin" | "source" | "decodedAt" | "rawPayload" | "errorCode" | "errorText">
> = {
  "1HGBH41JXMN109186": {
    year: 2021,
    make: "Honda",
    model: "Civic",
    trim: "LX",
    bodyClass: "Sedan",
    vehicleType: "PASSENGER CAR",
    fuelType: "Gasoline",
    engineCylinders: "4",
    displacementL: "2.0",
    manufacturer: "HONDA MOTOR CO., LTD",
    plantCity: null,
    plantState: null,
    plantCountry: "UNITED STATES (USA)",
    color: "Blue"
  },
  "5YJSA1E26MF123456": {
    year: 2021,
    make: "Tesla",
    model: "Model S",
    trim: "Long Range",
    bodyClass: "Sedan",
    vehicleType: "PASSENGER CAR",
    fuelType: "Electric",
    engineCylinders: null,
    displacementL: null,
    manufacturer: "TESLA, INC.",
    plantCity: null,
    plantState: null,
    plantCountry: "UNITED STATES (USA)",
    color: "White"
  }
};

@Injectable()
export class StubVinDecoderService implements VinDecoder {
  async decode(vin: string): Promise<VinDecodeResult> {
    const normalized = normalizeVin(vin);
    const decodedAt = new Date().toISOString();
    const known = KNOWN_VINS[normalized];

    if (known) {
      return {
        vin: normalized,
        ...known,
        errorCode: "0",
        errorText: null,
        source: "STUB",
        decodedAt,
        rawPayload: { vin: normalized, provider: "stub-known", mapped: true }
      };
    }

    const yearDigit = Number.parseInt(normalized.charAt(9) ?? "", 10);
    const modelYear = Number.isNaN(yearDigit)
      ? 2020
      : yearDigit >= 0 && yearDigit <= 9
        ? 2010 + yearDigit
        : 2020;

    return {
      vin: normalized,
      year: modelYear,
      make: "Stub Make",
      model: "Stub Model",
      trim: null,
      bodyClass: "Unknown",
      vehicleType: "PASSENGER CAR",
      fuelType: null,
      engineCylinders: null,
      displacementL: null,
      manufacturer: "Stub Manufacturer",
      plantCity: null,
      plantState: null,
      plantCountry: null,
      color: null,
      errorCode: "0",
      errorText: null,
      source: "STUB",
      decodedAt,
      rawPayload: {
        vin: normalized,
        provider: "stub-derived",
        note: "Deterministic local stub decoder for tests and offline development."
      }
    };
  }
}
