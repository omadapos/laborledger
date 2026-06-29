import { describe, expect, it } from "vitest";

import {
  buildCompanyProfileUpdatePayload,
  companyProfileApiPath,
  formatCompanyAddressLines,
  resolveCompanyDisplayName,
  validateCompanyProfileForm
} from "../../apps/admin/src/lib/company-profile-utils";

describe("company-profile-utils", () => {
  const profile = {
    companyId: "cmp_1",
    name: "Alpha Main Shop",
    currencyCode: "USD",
    legalName: "Alpha Fleet Services LLC",
    phone: "(555) 123-4567",
    billingEmail: "billing@alpha.example",
    primaryContactName: "Jordan Lee",
    addressLine1: "100 Service Lane",
    addressLine2: null,
    city: "Austin",
    stateRegion: "TX",
    postalCode: "78701",
    country: "United States"
  };

  it("builds API path and update payload", () => {
    expect(companyProfileApiPath("cmp_1")).toBe("/api/company-operations/companies/cmp_1/profile");
    expect(
      buildCompanyProfileUpdatePayload({
        legalName: " Alpha LLC ",
        phone: "",
        billingEmail: " Billing@Alpha.Example ",
        primaryContactName: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        stateRegion: "",
        postalCode: "",
        country: ""
      })
    ).toEqual({
      legalName: "Alpha LLC",
      phone: null,
      billingEmail: "billing@alpha.example",
      primaryContactName: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      stateRegion: null,
      postalCode: null,
      country: null
    });
  });

  it("validates billing email and phone", () => {
    expect(
      validateCompanyProfileForm({
        legalName: "",
        phone: "bad phone!",
        billingEmail: "not-an-email",
        primaryContactName: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        stateRegion: "",
        postalCode: "",
        country: ""
      })
    ).toEqual({
      phone: "Phone may contain only digits and common phone punctuation.",
      billingEmail: "Billing email must be a valid email address."
    });
  });

  it("resolves display name and formats address lines", () => {
    expect(resolveCompanyDisplayName(profile)).toBe("Alpha Fleet Services LLC");
    expect(resolveCompanyDisplayName({ ...profile, legalName: null })).toBe("Alpha Main Shop");
    expect(formatCompanyAddressLines(profile)).toEqual([
      "100 Service Lane",
      "Austin, TX 78701",
      "United States"
    ]);
  });
});
