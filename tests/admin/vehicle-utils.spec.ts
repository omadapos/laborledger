import { describe, expect, it } from "vitest";

import {
  canCreateVehicleIntake,
  canDecodeVin,
  formatVehicleTitle,
  formatVinDecodeSourceLabel,
  formatVinDecodeSummary,
  normalizeVin,
  parseOptionalMileageInput,
  validateVin,
  vehicleIntakeDisclaimer,
  vehiclesEmptyMessage,
  vinDecodeErrorCopy,
  type VinDecodePreviewRecord
} from "../../apps/admin/src/lib/vehicle-utils";

describe("vehicle-utils", () => {
  it("normalizes and validates VIN input", () => {
    expect(normalizeVin(" 1hgbh41jxmn109186 ")).toBe("1HGBH41JXMN109186");
    expect(validateVin("")).toBe("VIN is required.");
    expect(validateVin("1HGBH41JXMN109186")).toBeUndefined();
    expect(validateVin("1HGBH41JXMN10918I")).toContain("I, O, and Q");
  });

  it("formats vehicle title from decoded fields or falls back to VIN", () => {
    expect(
      formatVehicleTitle({
        year: 2021,
        make: "Honda",
        model: "Civic",
        vin: "1HGBH41JXMN109186"
      })
    ).toBe("2021 Honda Civic");

    expect(
      formatVehicleTitle({
        year: null,
        make: null,
        model: null,
        vin: "1HGBH41JXMN109186"
      })
    ).toBe("1HGBH41JXMN109186");
  });

  it("parses optional mileage input", () => {
    expect(parseOptionalMileageInput("")).toEqual({ mileage: undefined });
    expect(parseOptionalMileageInput("45000")).toEqual({ mileage: 45000 });
    expect(parseOptionalMileageInput("-1")).toEqual({ error: "Mileage must be a whole number." });
    expect(parseOptionalMileageInput("abc")).toEqual({ error: "Mileage must be a whole number." });
  });

  it("uses intake disclaimer that excludes invoice and payroll creation", () => {
    const copy = vehicleIntakeDisclaimer();
    expect(copy.toLowerCase()).toContain("vin is required");
    expect(copy.toLowerCase()).toContain("does not create an invoice");
    expect(copy.toLowerCase()).toContain("payroll record");
  });

  it("provides empty and filtered empty helper copy", () => {
    expect(vehiclesEmptyMessage(false).title).toBe("No vehicles yet");
    expect(vehiclesEmptyMessage(true).title).toBe("No vehicles match your filters");
  });

  it("supports VIN decode preview helpers", () => {
    expect(canDecodeVin("1HGBH41JXMN109186")).toBe(true);
    expect(canDecodeVin("INVALID")).toBe(false);
    expect(formatVinDecodeSourceLabel("NHTSA_VPIC")).toBe("NHTSA vPIC");
    expect(formatVinDecodeSourceLabel("STUB")).toBe("Local stub decoder");

    const preview: VinDecodePreviewRecord = {
      vin: "1HGBH41JXMN109186",
      year: 2021,
      make: "Honda",
      model: "Civic",
      trim: "LX",
      bodyClass: "Sedan",
      vehicleType: "PASSENGER CAR",
      fuelType: "Gasoline",
      decodeSource: "NHTSA_VPIC",
      decodedAt: "2026-06-22T00:00:00.000Z"
    };

    expect(formatVinDecodeSummary(preview)).toContain("2021 Honda Civic LX");
    expect(vinDecodeErrorCopy()).toContain("Unable to decode");
  });

  it("blocks vehicle create when prerequisites are missing", () => {
    expect(
      canCreateVehicleIntake(
        [{ id: "c1", name: "Archived", archivedAt: "2026-01-01T00:00:00.000Z" } as never],
        []
      )
    ).toBe(false);
    expect(
      canCreateVehicleIntake([{ id: "c1", name: "Active", archivedAt: null } as never], [])
    ).toBe(false);
    expect(
      canCreateVehicleIntake(
        [{ id: "c1", name: "Active", archivedAt: null } as never],
        [{ id: "l1", name: "Lot", archivedAt: null, serviceClientId: "c1" } as never]
      )
    ).toBe(true);
  });
});
