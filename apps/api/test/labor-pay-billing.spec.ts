import { describe, expect, it } from "vitest";

import {
  aggregateClientLaborBillingRows,
  aggregateEmployeePayRows,
  buildClientBillingCsv,
  buildEmployeePayCsv,
  matchesLaborFilters,
  minutesToHoursDecimal,
  parseOnlyClosedWeeks,
  summarizeLaborRows,
  type ShiftLaborRow
} from "../src/modules/labor-pay-billing/labor-pay-billing";

const sampleRows: ShiftLaborRow[] = [
  {
    shiftId: "shift-1",
    employeeId: "emp-1",
    employeeName: "Alex",
    locationId: "loc-1",
    locationName: "Site A",
    serviceClientId: "client-1",
    serviceClientName: "Client One",
    payableMinutes: 450,
    employeeRateMinor: 2000,
    clientRateMinor: 2500,
    employeeAmountMinor: 15000,
    clientAmountMinor: 18750,
    grossMarginMinor: 3750
  },
  {
    shiftId: "shift-2",
    employeeId: "emp-1",
    employeeName: "Alex",
    locationId: "loc-1",
    locationName: "Site A",
    serviceClientId: "client-1",
    serviceClientName: "Client One",
    payableMinutes: 30,
    employeeRateMinor: 2000,
    clientRateMinor: 2500,
    employeeAmountMinor: 1000,
    clientAmountMinor: 1250,
    grossMarginMinor: 250
  }
];

describe("labor pay billing helpers", () => {
  it("converts minutes to decimal hours without rounding buckets", () => {
    expect(minutesToHoursDecimal(90)).toBe(1.5);
    expect(minutesToHoursDecimal(7)).toBe(0.12);
  });

  it("aggregates employee pay rows by employee, location, and client", () => {
    const rows = aggregateEmployeePayRows(sampleRows, "2026-04-06", "2026-04-12");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.approvedPayableMinutes).toBe(480);
    expect(rows[0]?.estimatedGrossPayMinor).toBe(16000);
  });

  it("aggregates client billing rows with margin totals", () => {
    const rows = aggregateClientLaborBillingRows(sampleRows, "2026-04-06", "2026-04-12");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.approvedBillableMinutes).toBe(480);
    expect(rows[0]?.estimatedClientChargeMinor).toBe(20000);
    expect(rows[0]?.estimatedMarginMinor).toBe(4000);
  });

  it("summarizes labor totals", () => {
    expect(summarizeLaborRows(sampleRows)).toMatchObject({
      approvedShiftCount: 2,
      payableMinutes: 480,
      employeeGrossEstimateMinor: 16000,
      clientLaborEstimateMinor: 20000,
      grossMarginEstimateMinor: 4000
    });
  });

  it("builds CSV exports with required columns", () => {
    const employeeRows = aggregateEmployeePayRows(sampleRows, "2026-04-06", "2026-04-12");
    const clientRows = aggregateClientLaborBillingRows(sampleRows, "2026-04-06", "2026-04-12");

    const payrollCsv = buildEmployeePayCsv(employeeRows);
    expect(payrollCsv.split("\n")[0]).toContain("employee_name");
    expect(payrollCsv).toContain("Alex");
    expect(payrollCsv).toContain("480");

    const clientCsv = buildClientBillingCsv(clientRows);
    expect(clientCsv.split("\n")[0]).toContain("service_client");
    expect(clientCsv).toContain("Client One");
  });

  it("applies optional filters", () => {
    expect(
      matchesLaborFilters(sampleRows[0]!, {
        employeeId: "emp-1",
        locationId: "loc-1",
        serviceClientId: "client-1"
      })
    ).toBe(true);
    expect(
      matchesLaborFilters(sampleRows[0]!, {
        employeeId: "emp-2"
      })
    ).toBe(false);
  });

  it("parses onlyClosedWeeks query flag", () => {
    expect(parseOnlyClosedWeeks("true")).toBe(true);
    expect(parseOnlyClosedWeeks("false")).toBe(false);
    expect(parseOnlyClosedWeeks(true)).toBe(true);
  });
});
