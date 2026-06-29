import { describe, expect, it } from "vitest";

import {
  filterReviewShiftsByQuery,
  groupReviewShiftsByDate,
  reviewStatusLabel,
  warningBadgeLabel,
  type ReviewShiftRecord
} from "../../apps/admin/src/lib/review-utils";

function sampleShift(overrides: Partial<ReviewShiftRecord> = {}): ReviewShiftRecord {
  return {
    shiftId: "shift-1",
    companyId: "company-1",
    employee: { id: "emp-1", fullName: "Maria Gomez" },
    serviceClient: { id: "client-1", name: "Acme Client" },
    location: { id: "loc-1", name: "Main Site", timezone: "America/New_York" },
    scheduledStartUtc: "2026-04-06T13:00:00.000Z",
    scheduledEndUtc: "2026-04-06T21:00:00.000Z",
    clockInUtc: "2026-04-06T13:00:00.000Z",
    clockOutUtc: "2026-04-06T21:00:00.000Z",
    breakDurationMinutes: 30,
    workedMinutes: 450,
    additionalMinutes: 0,
    payableMinutes: 450,
    estimatedEmployeeAmountMinor: 14250,
    estimatedClientAmountMinor: 17250,
    currencyCode: "USD",
    punchState: "clocked_out",
    displayStatus: "needs_review",
    approvedAt: null,
    additionalTimeApprovedAt: null,
    warnings: [],
    canApproveShift: true,
    canApproveAdditionalTime: false,
    approvalBlockReasons: [],
    ...overrides
  };
}

describe("review utils", () => {
  it("builds warning badge labels", () => {
    expect(warningBadgeLabel("early_clock_in")).toBe("Early clock-in");
    expect(warningBadgeLabel("additional_time_pending")).toBe("Additional time");
  });

  it("labels review statuses", () => {
    expect(reviewStatusLabel("needs_review")).toBe("Needs review");
    expect(reviewStatusLabel("approved")).toBe("Approved");
  });

  it("filters shifts by employee, client, or location query", () => {
    const shifts = [
      sampleShift(),
      sampleShift({
        shiftId: "shift-2",
        employee: { id: "emp-2", fullName: "Other Person" },
        serviceClient: { id: "client-2", name: "Beta Client" },
        location: { id: "loc-2", name: "Warehouse", timezone: "America/New_York" }
      })
    ];

    expect(filterReviewShiftsByQuery(shifts, "maria")).toHaveLength(1);
    expect(filterReviewShiftsByQuery(shifts, "warehouse")).toHaveLength(1);
    expect(filterReviewShiftsByQuery(shifts, "")).toHaveLength(2);
  });

  it("groups shifts by scheduled date", () => {
    const shifts = [
      sampleShift({ scheduledStartUtc: "2026-04-06T13:00:00.000Z" }),
      sampleShift({
        shiftId: "shift-2",
        scheduledStartUtc: "2026-04-07T13:00:00.000Z"
      })
    ];

    const groups = groupReviewShiftsByDate(shifts);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.[0]).toBe("2026-04-06");
    expect(groups[1]?.[0]).toBe("2026-04-07");
  });
});
