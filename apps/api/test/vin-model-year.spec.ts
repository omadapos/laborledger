import { describe, expect, it } from "vitest";

import { deriveModelYearFromVin, resolveNhtsaModelYear } from "../src/modules/vin-decode/vin-model-year";

const HONDA_CRV_VIN = "5J6RM4H75DL028637";

describe("vin-model-year", () => {
  it("derives model year 2013 from VIN position 10 code D", () => {
    expect(deriveModelYearFromVin(HONDA_CRV_VIN)).toBe(2013);
  });

  it("returns null for invalid VIN length", () => {
    expect(deriveModelYearFromVin("SHORT")).toBeNull();
  });

  it("prefers explicit model year over derived value", () => {
    expect(resolveNhtsaModelYear(HONDA_CRV_VIN, 2014)).toBe(2014);
  });

  it("falls back to derived model year when explicit value is omitted", () => {
    expect(resolveNhtsaModelYear(HONDA_CRV_VIN)).toBe(2013);
  });
});
