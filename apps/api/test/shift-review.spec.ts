import { PunchAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  buildShiftReview,
  calculateAdditionalMinutes,
  isValidPunchSequence,
  matchesReviewStatusFilter
} from "../src/modules/shift-review/shift-review";
import type { PunchEventRecord } from "../src/modules/kiosk/punch-state";

function event(
  action: PunchAction,
  iso: string,
  extras?: Partial<PunchEventRecord>
): PunchEventRecord {
  return { action, eventUtc: new Date(iso), ...extras };
}

describe("shift review domain", () => {
  const scheduledEnd = new Date("2026-04-06T21:00:00.000Z");

  it("marks a clean clocked-out shift as review-ready", () => {
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

    expect(review.displayStatus).toBe("needs_review");
    expect(review.workedMinutes).toBe(450);
    expect(review.canApproveShift).toBe(true);
    expect(review.warnings).toHaveLength(0);
  });

  it("rejects approval when clock-out is missing", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 })
      ]
    });

    expect(review.displayStatus).toBe("incomplete");
    expect(review.canApproveShift).toBe(false);
    expect(review.warnings.some((warning) => warning.code === "missing_clock_out")).toBe(true);
  });

  it("rejects approval when break is open", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z")
      ]
    });

    expect(review.canApproveShift).toBe(false);
    expect(review.warnings.some((warning) => warning.code === "open_break")).toBe(true);
  });

  it("requires explicit approval for additional time after scheduled end", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:30:00.000Z")
      ]
    });

    expect(review.additionalMinutes).toBe(30);
    expect(review.workedMinutes).toBe(480);
    expect(review.payableMinutes).toBe(450);
    expect(review.canApproveShift).toBe(false);
    expect(review.canApproveAdditionalTime).toBe(true);
    expect(review.warnings.some((warning) => warning.code === "additional_time_pending")).toBe(true);
  });

  it("includes additional minutes in payable totals after explicit approval", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: new Date("2026-04-06T22:00:00.000Z"),
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:30:00.000Z")
      ]
    });

    expect(review.payableMinutes).toBe(480);
    expect(review.canApproveShift).toBe(true);
  });

  it("flags short and long breaks", () => {
    const shortBreak = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:20:00.000Z", { breakMinutes: 20 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ]
    });

    const longBreak = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:45:00.000Z", { breakMinutes: 45 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ]
    });

    expect(shortBreak.warnings.some((warning) => warning.code === "break_short")).toBe(true);
    expect(longBreak.warnings.some((warning) => warning.code === "break_long")).toBe(true);
  });

  it("flags early and late clock-in warnings", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T12:50:00.000Z", { isEarly: true }),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ]
    });

    expect(review.warnings.some((warning) => warning.code === "early_clock_in")).toBe(true);

    const lateReview = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:10:00.000Z", { isLate: true }),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ]
    });

    expect(lateReview.warnings.some((warning) => warning.code === "late_clock_in")).toBe(true);
  });

  it("uses integer minutes without rounding punch intervals", () => {
    const review = buildShiftReview({
      approvedAt: null,
      additionalTimeApprovedAt: null,
      scheduledEndUtc: scheduledEnd,
      events: [
        event(PunchAction.CLOCK_IN, "2026-04-06T13:07:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z", { breakMinutes: 30 }),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:03:00.000Z")
      ]
    });

    expect(review.workedMinutes).toBe(446);
    expect(Number.isInteger(review.workedMinutes)).toBe(true);
  });

  it("detects invalid punch sequences", () => {
    const events = [
      event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
      event(PunchAction.CLOCK_IN, "2026-04-06T13:05:00.000Z")
    ];

    expect(isValidPunchSequence(events)).toBe(false);
  });

  it("filters review statuses", () => {
    const needsReview = buildShiftReview({
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

    expect(matchesReviewStatusFilter(needsReview, "needs_review")).toBe(true);
    expect(matchesReviewStatusFilter(needsReview, "approved")).toBe(false);
  });

  it("calculates additional minutes after scheduled end", () => {
    expect(
      calculateAdditionalMinutes(
        new Date("2026-04-06T21:45:00.000Z"),
        new Date("2026-04-06T21:00:00.000Z")
      )
    ).toBe(45);
  });
});
