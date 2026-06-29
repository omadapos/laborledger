import { describe, expect, it } from "vitest";

import {
  buildOperationsReportQuery,
  formatInvoiceStatusLabel,
  formatOperationsReportMoney,
  hasOperationsReportActivity,
  operationsReportsEmptyMessage,
  parseOperationsReportSearchParams,
  resolveDefaultOperationsReportRange,
  validateOperationsReportDateInput
} from "../../apps/admin/src/lib/operations-reports-utils";

describe("operations-reports-utils", () => {
  it("builds default month-to-date query params", () => {
    const range = resolveDefaultOperationsReportRange();
    expect(validateOperationsReportDateInput(range.from)).toBe(true);
    expect(validateOperationsReportDateInput(range.to)).toBe(true);
    expect(buildOperationsReportQuery(range)).toContain("from=");
    expect(buildOperationsReportQuery(range)).toContain("to=");
  });

  it("parses search params with defaults", () => {
    const range = parseOperationsReportSearchParams({});
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
  });

  it("formats money and status labels", () => {
    expect(formatOperationsReportMoney(12500)).toBe("$125.00");
    expect(formatInvoiceStatusLabel("ISSUED")).toBe("Issued");
  });

  it("detects report activity and empty copy", () => {
    expect(
      hasOperationsReportActivity({
        kpis: {
          completedVehicles: 0,
          completedWorkOrders: 0,
          completedServiceLines: 0,
          issuedInvoiceCount: 0,
          voidInvoiceCount: 0,
          invoicedRevenueMinor: 0,
          voidedRevenueMinor: 0,
          netIssuedRevenueMinor: 0,
          pendingWorkOrderCount: 0,
          inProgressWorkOrderCount: 0,
          uninvoicedCompletedWorkOrderCount: 0
        },
        workOrderStatusSummary: [{ status: "DRAFT", count: 0 }]
      } as never)
    ).toBe(false);

    expect(operationsReportsEmptyMessage(false).title).toContain("No report data");
  });
});
