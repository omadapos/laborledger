import { describe, expect, it } from "vitest";

import {
  buildLaborCsvHref,
  buildLaborPayBillingQuery
} from "../../apps/admin/src/lib/labor-pay-billing-utils";

describe("labor pay billing admin utils", () => {
  it("builds preview query params", () => {
    expect(
      buildLaborPayBillingQuery({
        weekStart: "2026-04-06",
        locationId: "loc-1",
        onlyClosedWeeks: true
      })
    ).toBe("?weekStart=2026-04-06&locationId=loc-1&onlyClosedWeeks=true");
  });

  it("builds CSV download hrefs through admin BFF", () => {
    const href = buildLaborCsvHref("payroll", "company-1", {
      weekStart: "2026-04-06",
      weekEnd: "2026-04-12",
      onlyClosedWeeks: false
    });

    expect(href).toContain("/api/company-operations/companies/company-1/labor-pay-billing/payroll-csv");
    expect(href).toContain("weekStart=2026-04-06");
  });
});
