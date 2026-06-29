import { describe, expect, it } from "vitest";

import {
  buildShiftsListQuery,
  enrichShiftViews,
  formatCopyWeekSummary,
  formatScheduleConflict,
  getShiftDisplayDateKey,
  groupShiftsByStartDate,
  isOvernightShift,
  localDateTimeInTimeZoneToUtcIso,
  validateCancelReason,
  validateCopyWeekForm,
  validateShiftForm
} from "../../apps/admin/src/lib/shift-utils";

describe("shift-utils", () => {
  it("converts location-local date/time to UTC without using browser local zone", () => {
    const utc = localDateTimeInTimeZoneToUtcIso("2026-04-06", "09:00", "America/New_York");
    expect(new Date(utc).toISOString()).toBe("2026-04-06T13:00:00.000Z");
  });

  it("groups overnight shifts under scheduled start date", () => {
    const startUtc = "2026-04-06T02:00:00.000Z";
    const endUtc = "2026-04-06T10:00:00.000Z";
    const timeZone = "America/New_York";

    expect(isOvernightShift(startUtc, endUtc, timeZone)).toBe(true);
    expect(getShiftDisplayDateKey(startUtc, timeZone)).toBe("2026-04-05");

    const views = enrichShiftViews([
      {
        id: "s1",
        companyId: "c1",
        locationId: "l1",
        employeeId: "e1",
        serviceClientId: "sc1",
        status: "SCHEDULED",
        scheduledStartUtc: startUtc,
        scheduledEndUtc: endUtc,
        timezone: timeZone,
        createdAt: "2026-04-01T00:00:00.000Z",
        employee: { id: "e1", fullName: "Maria Gomez" },
        location: { id: "l1", name: "Site A", timezone: timeZone, serviceClientId: "sc1" },
        serviceClient: { id: "sc1", name: "Client A" }
      }
    ]);

    const groups = groupShiftsByStartDate(views);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.dateKey).toBe("2026-04-05");
  });

  it("rejects invalid shift form values", () => {
    const missingEmployee = validateShiftForm({
      employeeId: "",
      serviceClientId: "sc1",
      locationId: "l1",
      startDate: "2026-04-06",
      startTime: "09:00",
      endDate: "2026-04-06",
      endTime: "17:00",
      timeZone: "America/New_York"
    });

    expect(missingEmployee.errors.employeeId).toBeTruthy();

    const endBeforeStart = validateShiftForm({
      employeeId: "e1",
      serviceClientId: "sc1",
      locationId: "l1",
      startDate: "2026-04-06",
      startTime: "09:00",
      endDate: "2026-04-06",
      endTime: "08:00",
      timeZone: "America/New_York"
    });

    expect(endBeforeStart.errors.endTime).toBeTruthy();
  });

  it("validates cancel reason and copy-week form helpers", () => {
    expect(validateCancelReason("")).toBeTruthy();
    expect(validateCancelReason("Client closed")).toBeNull();
    expect(validateCopyWeekForm({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-06" })).toBeTruthy();
    expect(validateCopyWeekForm({ sourceWeekStart: "2026-04-06", targetWeekStart: "2026-04-13" })).toBeNull();
  });

  it("builds shift list query and formats copy-week summary", () => {
    const query = buildShiftsListQuery({
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-08T00:00:00.000Z",
      includeCancelled: true,
      locationId: "loc1"
    });
    expect(query).toContain("includeCancelled=true");
    expect(query).toContain("locationId=loc1");

    const summary = formatCopyWeekSummary({
      created: [],
      skipped: [],
      conflicts: [],
      summary: { createdCount: 2, skippedCount: 1, conflictCount: 1 }
    });
    expect(summary).toContain("Created 2");

    const conflictLine = formatScheduleConflict({
      employeeId: "e1",
      employeeName: "Maria",
      conflictingShiftId: "s2",
      scheduledStart: "2026-04-06T13:00:00.000Z",
      scheduledEnd: "2026-04-06T21:00:00.000Z",
      locationName: "Site A",
      reason: "overlapping_shift"
    });
    expect(conflictLine).toContain("Maria");
    expect(conflictLine).toContain("overlapping_shift");
  });
});
