import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { buildCompanyProfileUpdateData } from "../src/modules/company-operations/company-profile.validation";

describe("company-profile.validation", () => {
  it("trims values and converts empty strings to null", () => {
    expect(
      buildCompanyProfileUpdateData({
        legalName: "  Alpha LLC  ",
        phone: "",
        billingEmail: " Billing@Alpha.Example "
      })
    ).toEqual({
      legalName: "Alpha LLC",
      phone: null,
      billingEmail: "billing@alpha.example"
    });
  });

  it("rejects invalid billing email", () => {
    expect(() =>
      buildCompanyProfileUpdateData({
        billingEmail: "not-an-email"
      })
    ).toThrow(BadRequestException);
  });

  it("rejects too-long fields", () => {
    expect(() =>
      buildCompanyProfileUpdateData({
        legalName: "x".repeat(161)
      })
    ).toThrow(BadRequestException);
  });

  it("requires at least one field", () => {
    expect(() => buildCompanyProfileUpdateData({})).toThrow(BadRequestException);
  });
});
