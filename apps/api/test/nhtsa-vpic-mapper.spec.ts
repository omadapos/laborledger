import { describe, expect, it } from "vitest";

import { buildNhtsaDecodeUrl, collectNhtsaWarnings, mapNhtsaVpicResponse } from "../src/modules/vin-decode/nhtsa-vpic-mapper";

describe("nhtsa-vpic-mapper", () => {
  it("builds DecodeVinValuesExtended URLs", () => {
    expect(buildNhtsaDecodeUrl("https://vpic.nhtsa.dot.gov/api", "1HGCM82633A004352")).toBe(
      "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/1HGCM82633A004352?format=json"
    );

    expect(
      buildNhtsaDecodeUrl("https://vpic.nhtsa.dot.gov/api/", "1HGCM82633A004352", 2003)
    ).toBe(
      "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/1HGCM82633A004352?format=json&modelyear=2003"
    );
  });

  it("maps PascalCase DecodeVinValuesExtended fields", () => {
    const mapped = mapNhtsaVpicResponse(
      "1HGCM82633A004352",
      {
        Results: [
          {
            ModelYear: "2003",
            Make: "HONDA",
            Model: "Accord",
            Trim: "EX",
            BodyClass: "Coupe",
            VehicleType: "PASSENGER CAR",
            FuelTypePrimary: "Gasoline",
            EngineCylinders: "4",
            DisplacementL: "2.4",
            Manufacturer: "AMERICAN HONDA MOTOR CO., INC.",
            PlantCountry: "UNITED STATES (USA)",
            ErrorCode: "0",
            ErrorText: "0 - VIN decoded clean."
          }
        ]
      },
      "2026-06-22T00:00:00.000Z"
    );

    expect(mapped.source).toBe("NHTSA_VPIC");
    expect(mapped.year).toBe(2003);
    expect(mapped.make).toBe("HONDA");
    expect(mapped.model).toBe("Accord");
    expect(mapped.engineCylinders).toBe("4");
    expect(collectNhtsaWarnings(mapped)).toEqual([]);
  });

  it("collects NHTSA warning text when error code is not zero", () => {
    const warnings = collectNhtsaWarnings({
      errorCode: "1",
      errorText: "1 - Check Digit mismatch"
    });

    expect(warnings).toEqual(["1 - Check Digit mismatch"]);
  });
});
