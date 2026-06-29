import { describe, expect, it, vi } from "vitest";

import {
  buildNhtsaDecodeUrl,
  collectNhtsaWarnings,
  mapNhtsaVpicResponse
} from "../src/modules/vin-decode/nhtsa-vpic-mapper";
import { NhtsaVpicVinDecoderService } from "../src/modules/vin-decode/nhtsa-vpic-vin-decoder.service";
import { deriveModelYearFromVin } from "../src/modules/vin-decode/vin-model-year";
import { validateVin } from "../src/modules/vin-decode/vin-validation";

const HONDA_CRV_VIN = "5J6RM4H75DL028637";

const HONDA_CRV_NHTSA_ROW = {
  ModelYear: "2013",
  Make: "HONDA",
  Model: "CR-V",
  Trim: "EX-L",
  BodyClass: "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
  VehicleType: "MULTIPURPOSE PASSENGER VEHICLE (MPV)",
  FuelTypePrimary: "Gasoline",
  EngineCylinders: "4",
  DisplacementL: "2.4",
  Manufacturer: "AMERICAN HONDA MOTOR CO., INC.",
  PlantCity: "EAST LIBERTY",
  PlantState: "OHIO",
  PlantCountry: "UNITED STATES (USA)",
  NCSAMake: "Honda",
  NCSAModel: "CR-V",
  NCSABodyType: "Compact Utility (Utility Vehicle Categories \"Small\" and \"Midsize\")",
  ErrorCode: "0",
  ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct"
};

describe("VIN02-FIX01 Honda CR-V NHTSA decode accuracy", () => {
  it("rejects invalid VIN before external call", () => {
    expect(validateVin("INVALID")).toMatchObject({ error: expect.any(String) });
  });

  it("derives modelyear=2013 and builds the NHTSA URL for the Honda CR-V VIN", () => {
    expect(deriveModelYearFromVin(HONDA_CRV_VIN)).toBe(2013);
    expect(buildNhtsaDecodeUrl("https://vpic.nhtsa.dot.gov/api", HONDA_CRV_VIN, 2013)).toBe(
      "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/5J6RM4H75DL028637?format=json&modelyear=2013"
    );
  });

  it("maps DecodeVinValuesExtended PascalCase fields and prefers Make/Model over NCSA fields", () => {
    const mapped = mapNhtsaVpicResponse(
      HONDA_CRV_VIN,
      { Results: [HONDA_CRV_NHTSA_ROW] },
      "2026-06-22T00:00:00.000Z"
    );

    expect(mapped.year).toBe(2013);
    expect(mapped.make).toBe("HONDA");
    expect(mapped.model).toBe("CR-V");
    expect(mapped.trim).toBe("EX-L");
    expect(mapped.manufacturer).toBe("AMERICAN HONDA MOTOR CO., INC.");
    expect(mapped.plantCity).toBe("EAST LIBERTY");
    expect(mapped.plantState).toBe("OHIO");
    expect(mapped.plantCountry).toBe("UNITED STATES (USA)");
    expect(mapped.vehicleType?.toUpperCase()).toBe("MULTIPURPOSE PASSENGER VEHICLE (MPV)");
    expect(collectNhtsaWarnings(mapped)).toEqual([]);
  });

  it("sends modelyear=2013 on NHTSA fetch when modelYear is omitted", async () => {
    const mockFetch = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ Results: [HONDA_CRV_NHTSA_ROW] }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );

    const decoder = new NhtsaVpicVinDecoderService(mockFetch as typeof fetch);
    const decoded = await decoder.decode(HONDA_CRV_VIN);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0]?.[0])).toContain("modelyear=2013");
    expect(decoded.make).toBe("HONDA");
    expect(decoded.model).toBe("CR-V");
    expect(decoded.year).toBe(2013);
    expect(decoded.trim).toBe("EX-L");
  });

  it("still supports legacy spaced NHTSA field names as fallback", () => {
    const mapped = mapNhtsaVpicResponse(
      "1HGCM82633A004352",
      {
        Results: [
          {
            "Model Year": "2003",
            Make: "HONDA",
            Model: "Accord",
            Trim: "EX",
            "Body Class": "Coupe",
            "Vehicle Type": "PASSENGER CAR",
            "Fuel Type - Primary": "Gasoline",
            "Engine Number of Cylinders": "4",
            "Displacement (L)": "2.4",
            "Manufacturer Name": "AMERICAN HONDA MOTOR CO., INC.",
            "Plant Country": "UNITED STATES (USA)",
            "Error Code": "0",
            "Error Text": "0 - VIN decoded clean."
          }
        ]
      },
      "2026-06-22T00:00:00.000Z"
    );

    expect(mapped.year).toBe(2003);
    expect(mapped.make).toBe("HONDA");
    expect(mapped.model).toBe("Accord");
  });
});
