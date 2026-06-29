import type { ShiftReviewResult } from "../shift-review/shift-review";

export type WeeklyBlockerCode =
  | "missing_clock_in"
  | "missing_clock_out"
  | "open_break"
  | "invalid_punch_sequence"
  | "pending_additional_time"
  | "pending_correction"
  | "unapproved_shift"
  | "unresolved_exception";

export type WeeklyBlocker = {
  code: WeeklyBlockerCode;
  message: string;
  shiftId?: string;
  correctionId?: string;
  employeeName?: string;
  locationName?: string;
};

const BLOCKING_WARNING_CODES = new Set([
  "missing_clock_in",
  "missing_clock_out",
  "open_break",
  "invalid_punch_sequence",
  "additional_time_pending"
]);

export type WeeklyShiftSummaryInput = {
  shiftId: string;
  employeeName: string;
  locationName: string;
  approvedAt: Date | null;
  review: ShiftReviewResult;
};

export type PendingCorrectionInput = {
  id: string;
  shiftId: string;
  employeeName: string;
  locationName: string;
  status: string;
};

export function collectWeeklyBlockers(input: {
  shifts: WeeklyShiftSummaryInput[];
  pendingCorrections: PendingCorrectionInput[];
}): WeeklyBlocker[] {
  const blockers: WeeklyBlocker[] = [];

  for (const shift of input.shifts) {
    if (shift.approvedAt) {
      continue;
    }

    for (const warning of shift.review.warnings) {
      if (!BLOCKING_WARNING_CODES.has(warning.code)) {
        continue;
      }

      blockers.push({
        code: warning.code === "additional_time_pending" ? "pending_additional_time" : warning.code,
        message: warning.message,
        shiftId: shift.shiftId,
        employeeName: shift.employeeName,
        locationName: shift.locationName
      });
    }

    if (shift.review.displayStatus === "needs_review" && shift.review.canApproveShift) {
      blockers.push({
        code: "unapproved_shift",
        message: "Shift is ready for approval but has not been approved.",
        shiftId: shift.shiftId,
        employeeName: shift.employeeName,
        locationName: shift.locationName
      });
    }

    if (shift.review.displayStatus === "incomplete") {
      const hasBlockingWarning = shift.review.warnings.some((warning) =>
        BLOCKING_WARNING_CODES.has(warning.code)
      );

      if (!hasBlockingWarning) {
        blockers.push({
          code: "unresolved_exception",
          message: "Shift is incomplete and cannot be included in weekly close.",
          shiftId: shift.shiftId,
          employeeName: shift.employeeName,
          locationName: shift.locationName
        });
      }
    }

    const exceptionWarnings = shift.review.warnings.filter(
      (warning) => !BLOCKING_WARNING_CODES.has(warning.code)
    );

    if (
      shift.review.displayStatus === "needs_review" &&
      !shift.review.canApproveShift &&
      exceptionWarnings.length > 0 &&
      shift.review.warnings.every((warning) => !BLOCKING_WARNING_CODES.has(warning.code))
    ) {
      blockers.push({
        code: "unresolved_exception",
        message: exceptionWarnings[0]?.message ?? "Shift has unresolved review exceptions.",
        shiftId: shift.shiftId,
        employeeName: shift.employeeName,
        locationName: shift.locationName
      });
    }
  }

  for (const correction of input.pendingCorrections) {
    blockers.push({
      code: "pending_correction",
      message: `Correction is ${correction.status.toLowerCase()} and must be resolved before close.`,
      correctionId: correction.id,
      shiftId: correction.shiftId,
      employeeName: correction.employeeName,
      locationName: correction.locationName
    });
  }

  return blockers;
}

export function canCloseWeeklyPeriod(blockers: WeeklyBlocker[]) {
  return blockers.length === 0;
}

export function aggregateWeeklyTotals(
  shifts: Array<{
    approvedAt: Date | null;
    payableMinutes: number | null;
    employeeAmountMinor: number | null;
    clientAmountMinor: number | null;
  }>
) {
  let approvedShiftCount = 0;
  let payableMinutes = 0;
  let employeeGrossEstimateMinor = 0;
  let clientLaborEstimateMinor = 0;

  for (const shift of shifts) {
    if (!shift.approvedAt || shift.payableMinutes === null) {
      continue;
    }

    approvedShiftCount += 1;
    payableMinutes += shift.payableMinutes;
    employeeGrossEstimateMinor += shift.employeeAmountMinor ?? 0;
    clientLaborEstimateMinor += shift.clientAmountMinor ?? 0;
  }

  return {
    approvedShiftCount,
    payableMinutes,
    employeeGrossEstimateMinor,
    clientLaborEstimateMinor,
    grossMarginEstimateMinor: clientLaborEstimateMinor - employeeGrossEstimateMinor
  };
}
