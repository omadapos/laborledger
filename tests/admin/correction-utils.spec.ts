import { describe, expect, it } from "vitest";

import {
  correctionStatusLabel,
  filterCorrectionsByQuery,
  formatWorkedMinuteImpact,
  type CorrectionSummary
} from "../../apps/admin/src/lib/correction-utils";

function sampleCorrection(overrides: Partial<CorrectionSummary> = {}): CorrectionSummary {
  return {
    id: "corr-1",
    companyId: "company-1",
    shiftId: "shift-1",
    employee: { id: "emp-1", fullName: "Maria Gomez" },
    location: { id: "loc-1", name: "Main Site", timezone: "America/New_York" },
    type: "MISSING_CLOCK_OUT",
    typeLabel: "Missing clock-out",
    status: "PENDING",
    reason: "Forgot to clock out",
    requestedAt: "2026-04-06T21:30:00.000Z",
    requestedByLabel: "Company Admin",
    scheduledStartUtc: "2026-04-06T13:00:00.000Z",
    shiftTimezone: "America/New_York",
    ...overrides
  };
}

describe("correction utils", () => {
  it("labels correction statuses", () => {
    expect(correctionStatusLabel("PENDING")).toBe("Pending");
    expect(correctionStatusLabel("APPLIED")).toBe("Applied");
  });

  it("filters corrections by query", () => {
    const rows = [sampleCorrection(), sampleCorrection({ id: "corr-2", employee: { id: "emp-2", fullName: "Other Person" } })];
    expect(filterCorrectionsByQuery(rows, "maria")).toHaveLength(1);
  });

  it("formats worked-minute impact", () => {
    expect(
      formatWorkedMinuteImpact({
        originalWorkedMinutes: null,
        proposedWorkedMinutes: 450,
        originalPayableMinutes: null,
        proposedPayableMinutes: 450,
        originalPunchState: "clocked_in",
        proposedPunchState: "clocked_out"
      })
    ).toBe("— → 450 min");
  });
});
