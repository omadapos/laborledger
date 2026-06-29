import { describe, expect, it } from "vitest";

import { normalizeVin, validateVin } from "../src/modules/vin-decode/vin-validation";

describe("vin-validation", () => {
  it("normalizes VIN to uppercase without spaces", () => {
    expect(normalizeVin(" 1hgbh41jxmn109186 ")).toBe("1HGBH41JXMN109186");
  });

  it("rejects missing, empty, and whitespace-only VINs", () => {
    expect(validateVin(undefined)).toEqual({ error: "VIN is required." });
    expect(validateVin(null)).toEqual({ error: "VIN is required." });
    expect(validateVin("")).toEqual({ error: "VIN is required." });
    expect(validateVin("   ")).toEqual({ error: "VIN is required." });
  });

  it("rejects invalid VIN lengths and characters", () => {
    expect(validateVin("SHORT")).toEqual({ error: "VIN must be exactly 17 characters." });
    expect(validateVin("1HGBH41JXMN10918I")).toEqual({
      error: "VIN must use letters and digits only (I, O, and Q are not allowed)."
    });
  });

  it("accepts valid VINs", () => {
    expect(validateVin("1HGBH41JXMN109186")).toEqual({ vin: "1HGBH41JXMN109186" });
  });
});
