import { PunchAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { buildShiftReview } from "../src/modules/shift-review/shift-review";
import type { PunchEventRecord } from "../src/modules/kiosk/punch-state";
import {
  aggregateWeeklyTotals,
  canCloseWeeklyPeriod,
  collectWeeklyBlockers
} from "../src/modules/weekly-close/weekly-close";
import {
  addDaysToDateKey,
  computeTargetPayDate,
  computeWeekEndLocalDate,
  getMondayWeekStart
} from "../src/modules/weekly-close/week-period";

function event(action: PunchAction, iso: string): PunchEventRecord {
  return { action, eventUtc: new Date(iso) };
}

describe("week period helpers", () => {
  it("computes Monday through Sunday week boundaries from week start", () => {
    expect(computeWeekEndLocalDate("2026-04-06")).toBe("2026-04-12");
  });

  it("sets target pay date to the following Friday after week end", () => {
    expect(computeTargetPayDate("2026-04-12")).toBe("2026-04-17");
  });

  it("navigates week starts by seven days", () => {
    expect(addDaysToDateKey(getMondayWeekStart(new Date("2026-04-08T12:00:00.000Z")), 7)).toBe("2026-04-13");
  });
});

describe("weekly close blockers", () => {
  const scheduledEnd = new Date("2026-04-06T21:00:00.000Z");

  it("lists blockers for missing clock-out", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z")]
    });

    const blockers = collectWeeklyBlockers({
      shifts: [
        {
          shiftId: "shift-1",
          employeeName: "Maria",
          locationName: "Main",
          approvedAt: null,
          review
        }
      ],
      pendingCorrections: []
    });

    expect(blockers.some((blocker) => blocker.code === "missing_clock_out")).toBe(true);
    expect(canCloseWeeklyPeriod(blockers)).toBe(false);
  });

  it("lists blockers for open break", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z")
      ]
    });

    const blockers = collectWeeklyBlockers({
      shifts: [
        {
          shiftId: "shift-1",
          employeeName: "Maria",
          locationName: "Main",
          approvedAt: null,
          review
        }
      ],
      pendingCorrections: []
    });

    expect(blockers.some((blocker) => blocker.code === "open_break")).toBe(true);
  });

  it("lists blockers for unapproved shift and pending correction", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ]
    });

    const blockers = collectWeeklyBlockers({
      shifts: [
        {
          shiftId: "shift-1",
          employeeName: "Maria",
          locationName: "Main",
          approvedAt: null,
          review
        }
      ],
      pendingCorrections: [
        {
          id: "corr-1",
          shiftId: "shift-2",
          employeeName: "Alex",
          locationName: "Main",
          status: "PENDING"
        }
      ]
    });

    expect(blockers.some((blocker) => blocker.code === "unapproved_shift")).toBe(true);
    expect(blockers.some((blocker) => blocker.code === "pending_correction")).toBe(true);
  });

  it("allows close when all shifts are approved and corrections resolved", () => {
    const review = buildShiftReview({
      approvedAt: new Date("2026-04-07T12:00:00.000Z"),
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ]
    });

    const blockers = collectWeeklyBlockers({
      shifts: [
        {
          shiftId: "shift-1",
          employeeName: "Maria",
          locationName: "Main",
          approvedAt: new Date("2026-04-07T12:00:00.000Z"),
          review
        }
      ],
      pendingCorrections: []
    });

    expect(canCloseWeeklyPeriod(blockers)).toBe(true);
  });

  it("aggregates approved shift totals in integer minutes", () => {
    const totals = aggregateWeeklyTotals([
      {
        approvedAt: new Date(),
        payableMinutes: 450,
        employeeAmountMinor: 14250,
        clientAmountMinor: 17250
      },
      {
        approvedAt: null,
        payableMinutes: 120,
        employeeAmountMinor: 3800,
        clientAmountMinor: 4600
      }
    ]);

    expect(totals.approvedShiftCount).toBe(1);
    expect(totals.payableMinutes).toBe(450);
    expect(totals.employeeGrossEstimateMinor).toBe(14250);
    expect(totals.grossMarginEstimateMinor).toBe(3000);
  });
});
