import { PunchAction } from "@prisma/client";

export type PunchState = "scheduled" | "clocked_in" | "on_break" | "clocked_out";

export type PunchEventRecord = {
  action: PunchAction;
  eventUtc: Date;
  isLate?: boolean;
  isEarly?: boolean;
  breakMinutes?: number | null;
};

export const EARLY_CLOCK_IN_MINUTES = 10;
export const LATE_THRESHOLD_MINUTES = 5;
export const TARGET_BREAK_MINUTES = 30;

export function derivePunchState(events: PunchEventRecord[]): PunchState {
  if (events.length === 0) {
    return "scheduled";
  }

  let clockedIn = false;
  let onBreak = false;
  let clockedOut = false;

  for (const event of events) {
    switch (event.action) {
      case PunchAction.CLOCK_IN:
        clockedIn = true;
        onBreak = false;
        clockedOut = false;
        break;
      case PunchAction.BREAK_START:
        onBreak = true;
        break;
      case PunchAction.BREAK_END:
        onBreak = false;
        break;
      case PunchAction.CLOCK_OUT:
        clockedOut = true;
        clockedIn = false;
        onBreak = false;
        break;
      default:
        break;
    }
  }

  if (clockedOut) {
    return "clocked_out";
  }

  if (onBreak) {
    return "on_break";
  }

  if (clockedIn) {
    return "clocked_in";
  }

  return "scheduled";
}

export function countBreakStarts(events: PunchEventRecord[]) {
  return events.filter((event) => event.action === PunchAction.BREAK_START).length;
}

export function allowedActions(state: PunchState, breakCount: number): PunchAction[] {
  switch (state) {
    case "scheduled":
      return [PunchAction.CLOCK_IN];
    case "clocked_in":
      return breakCount >= 1
        ? [PunchAction.CLOCK_OUT]
        : [PunchAction.BREAK_START, PunchAction.CLOCK_OUT];
    case "on_break":
      return [PunchAction.BREAK_END];
    case "clocked_out":
      return [];
    default:
      return [];
  }
}

export function canApplyPunchAction(state: PunchState, action: PunchAction, breakCount = 0) {
  if (action === PunchAction.BREAK_START && breakCount >= 1) {
    return false;
  }

  return allowedActions(state, breakCount).includes(action);
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

export function evaluateClockInTiming(input: {
  now: Date;
  scheduledStartUtc: Date;
  scheduledEndUtc: Date;
}) {
  const earliestAllowedMs =
    input.scheduledStartUtc.getTime() - EARLY_CLOCK_IN_MINUTES * 60_000;
  const lateThresholdMs = input.scheduledStartUtc.getTime() + LATE_THRESHOLD_MINUTES * 60_000;

  if (input.now.getTime() < earliestAllowedMs) {
    return {
      allowed: false,
      reason: "Clock-in is not allowed more than 10 minutes before scheduled start."
    } as const;
  }

  if (input.now.getTime() > input.scheduledEndUtc.getTime()) {
    return {
      allowed: false,
      reason: "Clock-in after scheduled end requires a correction request."
    } as const;
  }

  const isEarly = input.now.getTime() < input.scheduledStartUtc.getTime();
  const isLate = input.now.getTime() > lateThresholdMs;

  return {
    allowed: true,
    isEarly,
    isLate
  } as const;
}

export function calculateWorkedMinutes(events: PunchEventRecord[]) {
  const clockIn = events.find((event) => event.action === PunchAction.CLOCK_IN);
  const clockOut = [...events].reverse().find((event) => event.action === PunchAction.CLOCK_OUT);

  if (!clockIn || !clockOut) {
    return null;
  }

  let breakMinutes = 0;
  const breakStart = events.find((event) => event.action === PunchAction.BREAK_START);
  const breakEnd = events.find((event) => event.action === PunchAction.BREAK_END);

  if (breakStart && breakEnd) {
    breakMinutes =
      breakEnd.breakMinutes ?? minutesBetween(breakStart.eventUtc, breakEnd.eventUtc);
  }

  const grossMinutes = minutesBetween(clockIn.eventUtc, clockOut.eventUtc);
  return Math.max(0, grossMinutes - breakMinutes);
}

export function buildBreakWarnings(breakMinutes: number | null) {
  if (breakMinutes === null) {
    return [] as string[];
  }

  if (breakMinutes === TARGET_BREAK_MINUTES) {
    return [];
  }

  return [`Break duration was ${breakMinutes} minutes; target is ${TARGET_BREAK_MINUTES} minutes.`];
}

export function mapPunchAction(action: string): PunchAction | null {
  switch (action) {
    case "clock_in":
      return PunchAction.CLOCK_IN;
    case "break_start":
      return PunchAction.BREAK_START;
    case "break_end":
      return PunchAction.BREAK_END;
    case "clock_out":
      return PunchAction.CLOCK_OUT;
    default:
      return null;
  }
}

export function mapPunchStateToResponse(state: PunchState) {
  return state;
}

export function invalidTransitionMessage(
  state: PunchState,
  action: PunchAction,
  breakCount = 0
) {
  if (action === PunchAction.BREAK_START && breakCount >= 1) {
    return "Only one unpaid break is allowed per shift.";
  }

  if (action === PunchAction.BREAK_START && state === "scheduled") {
    return "Break start requires an active clock-in.";
  }

  if (action === PunchAction.BREAK_END && state !== "on_break") {
    return "Break end requires an active break.";
  }

  if (action === PunchAction.CLOCK_OUT && state === "on_break") {
    return "Clock-out is not allowed while a break is open.";
  }

  if (action === PunchAction.CLOCK_OUT && state === "scheduled") {
    return "Clock-out requires an active clock-in.";
  }

  if (action === PunchAction.CLOCK_IN && state !== "scheduled") {
    return "Clock-in is not allowed for the current punch state.";
  }

  return "Invalid punch state transition.";
}
