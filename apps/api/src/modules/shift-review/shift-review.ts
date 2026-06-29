import { PunchAction } from "@prisma/client";

import {
  calculateWorkedMinutes,
  canApplyPunchAction,
  countBreakStarts,
  derivePunchState,
  minutesBetween,
  TARGET_BREAK_MINUTES,
  type PunchEventRecord,
  type PunchState
} from "../kiosk/punch-state";

export type ReviewWarningCode =
  | "late_clock_in"
  | "early_clock_in"
  | "break_short"
  | "break_long"
  | "additional_time_pending"
  | "incomplete_shift"
  | "open_break"
  | "invalid_punch_sequence"
  | "missing_clock_in"
  | "missing_clock_out";

export type ReviewWarning = {
  code: ReviewWarningCode;
  message: string;
};

export type ReviewDisplayStatus = "approved" | "needs_review" | "incomplete";

export type ReviewStatusFilter = "needs_review" | "approved" | "incomplete" | "exceptions";

export type ReviewShiftInput = {
  approvedAt: Date | null;
  additionalTimeApprovedAt: Date | null;
  scheduledEndUtc: Date;
  events: PunchEventRecord[];
};

export type ShiftReviewResult = {
  punchState: PunchState;
  displayStatus: ReviewDisplayStatus;
  clockInUtc: Date | null;
  clockOutUtc: Date | null;
  breakDurationMinutes: number | null;
  workedMinutes: number | null;
  additionalMinutes: number;
  payableMinutes: number | null;
  warnings: ReviewWarning[];
  canApproveShift: boolean;
  canApproveAdditionalTime: boolean;
  approvalBlockReasons: string[];
};

export function mapDbPunchEvents(
  events: Array<{
    action: PunchAction;
    eventUtc: Date;
    isLate: boolean;
    isEarly: boolean;
    breakMinutes: number | null;
  }>
): PunchEventRecord[] {
  return events.map((event) => ({
    action: event.action,
    eventUtc: event.eventUtc,
    isLate: event.isLate,
    isEarly: event.isEarly,
    breakMinutes: event.breakMinutes
  }));
}

export function isValidPunchSequence(events: PunchEventRecord[]) {
  let state: PunchState = "scheduled";
  let breakCount = 0;

  for (const event of events) {
    if (!canApplyPunchAction(state, event.action, breakCount)) {
      return false;
    }

    if (event.action === PunchAction.BREAK_START) {
      breakCount += 1;
    }

    switch (event.action) {
      case PunchAction.CLOCK_IN:
        state = "clocked_in";
        break;
      case PunchAction.BREAK_START:
        state = "on_break";
        break;
      case PunchAction.BREAK_END:
        state = "clocked_in";
        break;
      case PunchAction.CLOCK_OUT:
        state = "clocked_out";
        break;
      default:
        break;
    }
  }

  return true;
}

export function calculateBreakDurationMinutes(events: PunchEventRecord[]) {
  const breakStart = events.find((event) => event.action === PunchAction.BREAK_START);
  const breakEnd = events.find((event) => event.action === PunchAction.BREAK_END);

  if (!breakStart && !breakEnd) {
    return null;
  }

  if (breakStart && breakEnd) {
    return breakEnd.breakMinutes ?? minutesBetween(breakStart.eventUtc, breakEnd.eventUtc);
  }

  return null;
}

export function calculateAdditionalMinutes(clockOut: Date, scheduledEndUtc: Date) {
  if (clockOut <= scheduledEndUtc) {
    return 0;
  }

  return minutesBetween(scheduledEndUtc, clockOut);
}

export function estimateAmountMinor(payableMinutes: number | null, rateMinorUnits: number) {
  if (payableMinutes === null) {
    return null;
  }

  return Math.floor((payableMinutes * rateMinorUnits) / 60);
}

export function buildShiftReview(input: ReviewShiftInput): ShiftReviewResult {
  const punchState = derivePunchState(input.events);
  const clockIn = input.events.find((event) => event.action === PunchAction.CLOCK_IN) ?? null;
  const clockOut =
    [...input.events].reverse().find((event) => event.action === PunchAction.CLOCK_OUT) ?? null;
  const missingClockIn = !clockIn;
  const missingClockOut = !clockOut;
  const openBreak = punchState === "on_break";
  const invalidSequence = input.events.length > 0 && !isValidPunchSequence(input.events);
  const breakDurationMinutes = calculateBreakDurationMinutes(input.events);
  const workedMinutes = calculateWorkedMinutes(input.events);
  const additionalMinutes = clockOut
    ? calculateAdditionalMinutes(clockOut.eventUtc, input.scheduledEndUtc)
    : 0;

  const warnings: ReviewWarning[] = [];

  if (missingClockIn) {
    warnings.push({
      code: "missing_clock_in",
      message: "Clock-in is missing."
    });
  }

  if (missingClockOut) {
    warnings.push({
      code: "missing_clock_out",
      message: "Clock-out is missing."
    });
  }

  if (openBreak) {
    warnings.push({
      code: "open_break",
      message: "Break is still open."
    });
  }

  if (invalidSequence) {
    warnings.push({
      code: "invalid_punch_sequence",
      message: "Punch sequence is invalid."
    });
  }

  if (clockIn?.isLate) {
    warnings.push({
      code: "late_clock_in",
      message: "Clock-in was after the late threshold."
    });
  }

  if (clockIn?.isEarly) {
    warnings.push({
      code: "early_clock_in",
      message: "Early clock-in minutes are included and flagged for review."
    });
  }

  if (breakDurationMinutes !== null && breakDurationMinutes < TARGET_BREAK_MINUTES) {
    warnings.push({
      code: "break_short",
      message: `Break duration was ${breakDurationMinutes} minutes; target is ${TARGET_BREAK_MINUTES} minutes.`
    });
  }

  if (breakDurationMinutes !== null && breakDurationMinutes > TARGET_BREAK_MINUTES) {
    warnings.push({
      code: "break_long",
      message: `Break duration was ${breakDurationMinutes} minutes; target is ${TARGET_BREAK_MINUTES} minutes.`
    });
  }

  if (additionalMinutes > 0 && !input.additionalTimeApprovedAt) {
    warnings.push({
      code: "additional_time_pending",
      message: `${additionalMinutes} minutes after scheduled end require explicit approval.`
    });
  }

  const incomplete =
    missingClockIn ||
    missingClockOut ||
    openBreak ||
    invalidSequence ||
    punchState === "clocked_in" ||
    punchState === "on_break";

  if (incomplete && punchState !== "clocked_out" && !openBreak && !missingClockIn && !missingClockOut) {
    warnings.push({
      code: "incomplete_shift",
      message: "Shift is incomplete and cannot be approved."
    });
  } else if (
    incomplete &&
    (missingClockIn || missingClockOut || openBreak || invalidSequence || punchState === "clocked_in")
  ) {
    const alreadyFlagged = warnings.some((warning) =>
      ["missing_clock_in", "missing_clock_out", "open_break", "invalid_punch_sequence"].includes(
        warning.code
      )
    );
    if (!alreadyFlagged) {
      warnings.push({
        code: "incomplete_shift",
        message: "Shift is incomplete and cannot be approved."
      });
    }
  }

  const displayStatus: ReviewDisplayStatus = input.approvedAt
    ? "approved"
    : incomplete
      ? "incomplete"
      : "needs_review";

  const payableMinutes =
    workedMinutes === null
      ? null
      : additionalMinutes > 0 && !input.additionalTimeApprovedAt
        ? Math.max(0, workedMinutes - additionalMinutes)
        : workedMinutes;

  const approvalBlockReasons: string[] = [];

  if (input.approvedAt) {
    approvalBlockReasons.push("Shift is already approved.");
  }

  if (missingClockIn) {
    approvalBlockReasons.push("Clock-in is missing.");
  }

  if (missingClockOut) {
    approvalBlockReasons.push("Clock-out is missing.");
  }

  if (openBreak) {
    approvalBlockReasons.push("Break is still open.");
  }

  if (invalidSequence) {
    approvalBlockReasons.push("Punch sequence is invalid.");
  }

  if (punchState !== "clocked_out") {
    approvalBlockReasons.push("Shift must be clocked out before approval.");
  }

  if (additionalMinutes > 0 && !input.additionalTimeApprovedAt) {
    approvalBlockReasons.push("Additional time after scheduled end must be approved first.");
  }

  const canApproveShift = approvalBlockReasons.length === 0;
  const canApproveAdditionalTime =
    additionalMinutes > 0 &&
    !input.additionalTimeApprovedAt &&
    punchState === "clocked_out" &&
    !missingClockOut &&
    !openBreak &&
    !invalidSequence;

  return {
    punchState,
    displayStatus,
    clockInUtc: clockIn?.eventUtc ?? null,
    clockOutUtc: clockOut?.eventUtc ?? null,
    breakDurationMinutes,
    workedMinutes,
    additionalMinutes,
    payableMinutes,
    warnings,
    canApproveShift,
    canApproveAdditionalTime,
    approvalBlockReasons
  };
}

export function matchesReviewStatusFilter(
  review: Pick<ShiftReviewResult, "displayStatus" | "warnings">,
  status?: ReviewStatusFilter
) {
  if (!status) {
    return true;
  }

  switch (status) {
    case "approved":
      return review.displayStatus === "approved";
    case "incomplete":
      return review.displayStatus === "incomplete";
    case "needs_review":
      return review.displayStatus === "needs_review";
    case "exceptions":
      return review.displayStatus !== "approved" && review.warnings.length > 0;
    default:
      return true;
  }
}

export function countBreakStartsForReview(events: PunchEventRecord[]) {
  return countBreakStarts(events);
}
