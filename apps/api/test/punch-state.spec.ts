import { PunchAction } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  allowedActions,
  canApplyPunchAction,
  countBreakStarts,
  derivePunchState,
  evaluateClockInTiming,
  invalidTransitionMessage,
  type PunchEventRecord
} from "../src/modules/kiosk/punch-state";

function event(action: PunchAction, iso: string): PunchEventRecord {
  return { action, eventUtc: new Date(iso) };
}

describe("punch state machine", () => {
  it("derives scheduled when no events exist", () => {
    expect(derivePunchState([])).toBe("scheduled");
  });

  it("derives clocked_in after clock-in", () => {
    expect(derivePunchState([event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z")])).toBe(
      "clocked_in"
    );
  });

  it("derives on_break after break start", () => {
    expect(
      derivePunchState([
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z")
      ])
    ).toBe("on_break");
  });

  it("derives clocked_out after full sequence", () => {
    expect(
      derivePunchState([
        event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
        event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
        event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z"),
        event(PunchAction.CLOCK_OUT, "2026-04-06T21:00:00.000Z")
      ])
    ).toBe("clocked_out");
  });

  it("allows clock-in only from scheduled", () => {
    expect(canApplyPunchAction("scheduled", PunchAction.CLOCK_IN)).toBe(true);
    expect(canApplyPunchAction("clocked_in", PunchAction.CLOCK_IN)).toBe(false);
  });

  it("rejects second break start", () => {
    const events = [
      event(PunchAction.CLOCK_IN, "2026-04-06T13:00:00.000Z"),
      event(PunchAction.BREAK_START, "2026-04-06T17:00:00.000Z"),
      event(PunchAction.BREAK_END, "2026-04-06T17:30:00.000Z")
    ];
    const breakCount = countBreakStarts(events);
    expect(canApplyPunchAction("clocked_in", PunchAction.BREAK_START, breakCount)).toBe(false);
    expect(invalidTransitionMessage("clocked_in", PunchAction.BREAK_START, breakCount)).toContain(
      "Only one unpaid break"
    );
  });

  it("rejects clock-out during open break", () => {
    expect(canApplyPunchAction("on_break", PunchAction.CLOCK_OUT)).toBe(false);
    expect(invalidTransitionMessage("on_break", PunchAction.CLOCK_OUT)).toContain("break is open");
  });

  it("accepts clock-in exactly 10 minutes before scheduled start", () => {
    const scheduledStartUtc = new Date("2026-04-06T13:00:00.000Z");
    const scheduledEndUtc = new Date("2026-04-06T21:00:00.000Z");
    const now = new Date("2026-04-06T12:50:00.000Z");

    const timing = evaluateClockInTiming({ now, scheduledStartUtc, scheduledEndUtc });
    expect(timing.allowed).toBe(true);
    expect(timing.isEarly).toBe(true);
    expect(timing.isLate).toBe(false);
  });

  it("rejects clock-in before allowed window", () => {
    const timing = evaluateClockInTiming({
      now: new Date("2026-04-06T12:49:59.000Z"),
      scheduledStartUtc: new Date("2026-04-06T13:00:00.000Z"),
      scheduledEndUtc: new Date("2026-04-06T21:00:00.000Z")
    });
    expect(timing.allowed).toBe(false);
  });

  it("marks clock-in late after 5 minutes past start", () => {
    const timing = evaluateClockInTiming({
      now: new Date("2026-04-06T13:06:00.000Z"),
      scheduledStartUtc: new Date("2026-04-06T13:00:00.000Z"),
      scheduledEndUtc: new Date("2026-04-06T21:00:00.000Z")
    });
    expect(timing.allowed).toBe(true);
    expect(timing.isLate).toBe(true);
  });

  it("does not mark exactly 5 minutes late as late", () => {
    const timing = evaluateClockInTiming({
      now: new Date("2026-04-06T13:05:00.000Z"),
      scheduledStartUtc: new Date("2026-04-06T13:00:00.000Z"),
      scheduledEndUtc: new Date("2026-04-06T21:00:00.000Z")
    });
    expect(timing.allowed).toBe(true);
    expect(timing.isLate).toBe(false);
  });

  it("rejects clock-in after scheduled end", () => {
    const timing = evaluateClockInTiming({
      now: new Date("2026-04-06T21:01:00.000Z"),
      scheduledStartUtc: new Date("2026-04-06T13:00:00.000Z"),
      scheduledEndUtc: new Date("2026-04-06T21:00:00.000Z")
    });
    expect(timing.allowed).toBe(false);
  });

  it("lists allowed actions by state", () => {
    expect(allowedActions("scheduled", 0)).toEqual([PunchAction.CLOCK_IN]);
    expect(allowedActions("clocked_in", 0)).toEqual([
      PunchAction.BREAK_START,
      PunchAction.CLOCK_OUT
    ]);
    expect(allowedActions("clocked_in", 1)).toEqual([PunchAction.CLOCK_OUT]);
    expect(allowedActions("on_break", 0)).toEqual([PunchAction.BREAK_END]);
  });
});
