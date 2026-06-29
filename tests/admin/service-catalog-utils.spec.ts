import { describe, expect, it } from "vitest";

import {
  filterServiceCatalogItems,
  formatServiceCatalogPrice,
  parseDollarsToMinorUnits,
  serviceCatalogPricingDisclaimer,
  validateServiceCatalogName
} from "../../apps/admin/src/lib/service-catalog-utils";

describe("service-catalog-utils", () => {
  const sampleItems = [
    {
      id: "1",
      companyId: "c1",
      name: "Interior Detailing",
      description: "Full interior",
      category: "Detailing",
      fixedPriceMinor: 12500,
      currencyCode: "USD",
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "2",
      companyId: "c1",
      name: "Smoke odor removal",
      description: null,
      category: "Repair",
      fixedPriceMinor: 25000,
      currencyCode: "USD",
      archivedAt: null,
      createdAt: "2026-01-02T00:00:00.000Z"
    }
  ];

  it("rejects empty service name", () => {
    expect(validateServiceCatalogName("")).toBe("Service name is required.");
    expect(validateServiceCatalogName("   ")).toBe("Service name is required.");
    expect(validateServiceCatalogName("Detailing")).toBeUndefined();
  });

  it("parses dollar input to integer minor units", () => {
    expect(parseDollarsToMinorUnits("125.00")).toEqual({ minorUnits: 12500 });
    expect(parseDollarsToMinorUnits("19.99")).toEqual({ minorUnits: 1999 });
    expect(parseDollarsToMinorUnits("0")).toEqual({ error: "Fixed service price must be greater than zero." });
    expect(parseDollarsToMinorUnits("abc")).toEqual({
      error: "Enter a valid price with up to two decimal places."
    });
  });

  it("formats service catalog prices as client-facing amounts", () => {
    expect(formatServiceCatalogPrice(12500)).toBe("$125.00");
  });

  it("filters by name and category", () => {
    expect(filterServiceCatalogItems(sampleItems, "smoke", "")).toHaveLength(1);
    expect(filterServiceCatalogItems(sampleItems, "", "detailing")).toHaveLength(1);
    expect(filterServiceCatalogItems(sampleItems, "", "")).toHaveLength(2);
  });

  it("uses pricing disclaimer that excludes payroll and tax language", () => {
    const copy = serviceCatalogPricingDisclaimer();
    expect(copy.toLowerCase()).toContain("client-facing");
    expect(copy.toLowerCase()).toContain("not payroll");
    expect(copy.toLowerCase()).not.toContain("invoice issued");
  });
});
