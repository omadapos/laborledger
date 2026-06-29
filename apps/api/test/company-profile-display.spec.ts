import { describe, expect, it } from "vitest";

import {
  buildCompanyProfileHeaderLines,
  formatCompanyAddressLines,
  formatCompanyContactLines,
  resolveCompanyDisplayName
} from "../src/modules/company-operations/company-profile-display";

describe("company-profile-display", () => {
  const profile = {
    name: "Alpha Main Shop",
    legalName: "Alpha Fleet Services LLC",
    phone: "+1 (555) 123-4567",
    billingEmail: "billing@alpha.example",
    primaryContactName: "Jordan Lee",
    addressLine1: "100 Service Lane",
    addressLine2: "Suite 200",
    city: "Austin",
    stateRegion: "TX",
    postalCode: "78701",
    country: "United States"
  };

  it("uses legal name when present", () => {
    expect(resolveCompanyDisplayName(profile)).toBe("Alpha Fleet Services LLC");
  });

  it("falls back to company name when legal name is blank", () => {
    expect(resolveCompanyDisplayName({ ...profile, legalName: null })).toBe("Alpha Main Shop");
    expect(resolveCompanyDisplayName({ ...profile, legalName: "   " })).toBe("Alpha Main Shop");
  });

  it("formats address and contact lines", () => {
    expect(formatCompanyAddressLines(profile)).toEqual([
      "100 Service Lane",
      "Suite 200",
      "Austin, TX 78701",
      "United States"
    ]);
    expect(formatCompanyContactLines(profile)).toEqual([
      "Phone: +1 (555) 123-4567",
      "Billing email: billing@alpha.example",
      "Contact: Jordan Lee"
    ]);
    expect(buildCompanyProfileHeaderLines(profile)).toEqual([
      "Alpha Fleet Services LLC",
      "100 Service Lane",
      "Suite 200",
      "Austin, TX 78701",
      "United States",
      "Phone: +1 (555) 123-4567",
      "Billing email: billing@alpha.example",
      "Contact: Jordan Lee"
    ]);
    expect(
      buildCompanyProfileHeaderLines({
        name: "Alpha Main Shop",
        legalName: null,
        phone: null,
        billingEmail: null,
        primaryContactName: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        stateRegion: null,
        postalCode: null,
        country: null
      })
    ).toEqual(["Alpha Main Shop"]);
  });
});
