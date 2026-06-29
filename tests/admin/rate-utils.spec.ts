import { describe, expect, it } from "vitest";

import {
  buildClientLaborRateViews,
  buildEmployeeRateViews,
  classifyRateSource,
  DEFAULT_CLIENT_LABOR_RATE_MINOR,
  DEFAULT_EMPLOYEE_RATE_MINOR,
  formatRateDisplay,
  grossMarginDisclaimerCopy,
  resolveCurrentRate
} from "../../apps/admin/src/lib/rate-utils";

describe("rate-utils", () => {
  it("formats USD hourly rates", () => {
    expect(formatRateDisplay(1900)).toBe("$19.00/hr");
    expect(formatRateDisplay(2300)).toBe("$23.00/hr");
  });

  it("labels default vs override rates", () => {
    const defaultRate = {
      id: "1",
      rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
      currencyCode: "USD",
      effectiveStart: "2026-01-01T00:00:00.000Z",
      effectiveEnd: null
    };

    expect(classifyRateSource(defaultRate, [defaultRate], DEFAULT_EMPLOYEE_RATE_MINOR)).toBe("Default");

    const overrideRate = { ...defaultRate, rateMinorUnits: 2100 };
    expect(classifyRateSource(overrideRate, [defaultRate, overrideRate], DEFAULT_EMPLOYEE_RATE_MINOR)).toBe(
      "Override"
    );
  });

  it("builds employee rate views from effective records", () => {
    const rates = new Map([
      [
        "e1",
        [
          {
            id: "r1",
            rateMinorUnits: DEFAULT_EMPLOYEE_RATE_MINOR,
            currencyCode: "USD",
            effectiveStart: "2026-01-01T00:00:00.000Z",
            effectiveEnd: null
          }
        ]
      ]
    ]);

    const views = buildEmployeeRateViews(
      [{ id: "e1", fullName: "Jane Smith", archivedAt: null }],
      rates
    );

    expect(views).toHaveLength(1);
    expect(views[0]?.source).toBe("Default");
    expect(views[0]?.employeeName).toBe("Jane Smith");
  });

  it("uses estimate language in gross margin copy", () => {
    const copy = grossMarginDisclaimerCopy();
    expect(copy.toLowerCase()).toContain("estimate");
    expect(copy.toLowerCase()).not.toContain("invoice");
    expect(copy.toLowerCase()).not.toContain("payroll");
  });

  it("resolves the current effective rate", () => {
    const current = resolveCurrentRate(
      [
        {
          id: "old",
          rateMinorUnits: 1900,
          currencyCode: "USD",
          effectiveStart: "2025-01-01T00:00:00.000Z",
          effectiveEnd: "2026-01-01T00:00:00.000Z"
        },
        {
          id: "now",
          rateMinorUnits: 2100,
          currencyCode: "USD",
          effectiveStart: "2026-01-01T00:00:00.000Z",
          effectiveEnd: null
        }
      ],
      new Date("2026-06-01T00:00:00.000Z")
    );

    expect(current?.id).toBe("now");
  });

  it("builds client labor rate views", () => {
    const rates = new Map([
      [
        "sc1",
        [
          {
            id: "r1",
            rateMinorUnits: DEFAULT_CLIENT_LABOR_RATE_MINOR,
            currencyCode: "USD",
            effectiveStart: "2026-01-01T00:00:00.000Z",
            effectiveEnd: null
          }
        ]
      ]
    ]);

    const views = buildClientLaborRateViews([{ id: "sc1", name: "Acme", archivedAt: null }], rates);
    expect(views[0]?.serviceClientName).toBe("Acme");
    expect(views[0]?.source).toBe("Default");
  });
});
