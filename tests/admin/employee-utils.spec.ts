import { describe, expect, it } from "vitest";

import {
  filterEmployeesByQuery,
  resolveCurrentEmployeeRate,
  validateEmployeeFullName,
  validateEmployeePin
} from "../../apps/admin/src/lib/employee-utils";

describe("employee-utils", () => {
  it("requires a full name", () => {
    expect(validateEmployeeFullName("")).toBe("Full name is required.");
    expect(validateEmployeeFullName("Jane Smith")).toBeNull();
  });

  it("validates kiosk PIN format", () => {
    expect(validateEmployeePin("12345")).toBe("PIN must be exactly 6 digits.");
    expect(validateEmployeePin("123456")).toBeNull();
  });

  it("filters employees by name", () => {
    const employees = [
      { id: "1", fullName: "Jane Smith", archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "2", fullName: "John Doe", archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z" }
    ];

    expect(filterEmployeesByQuery(employees, "jane")).toHaveLength(1);
    expect(filterEmployeesByQuery(employees, "")).toHaveLength(2);
  });

  it("resolves the current effective employee rate", () => {
    const rates = [
      {
        id: "old",
        rateMinorUnits: 1900,
        currencyCode: "USD",
        effectiveStart: "2025-01-01T00:00:00.000Z",
        effectiveEnd: "2026-01-01T00:00:00.000Z"
      },
      {
        id: "current",
        rateMinorUnits: 2100,
        currencyCode: "USD",
        effectiveStart: "2026-01-01T00:00:00.000Z",
        effectiveEnd: null
      }
    ];

    const current = resolveCurrentEmployeeRate(rates, new Date("2026-06-01T00:00:00.000Z"));
    expect(current?.id).toBe("current");
    expect(current?.rateMinorUnits).toBe(2100);
  });
});
