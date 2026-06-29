import { formatShiftTimeRange } from "./shift-utils";

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

export type ReviewStatusFilter = "" | "needs_review" | "approved" | "incomplete" | "exceptions";

export type ReviewShiftRecord = {
  shiftId: string;
  companyId: string;
  employee: { id: string; fullName: string };
  serviceClient: { id: string; name: string };
  location: { id: string; name: string; timezone: string };
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  clockInUtc: string | null;
  clockOutUtc: string | null;
  breakDurationMinutes: number | null;
  workedMinutes: number | null;
  additionalMinutes: number;
  payableMinutes: number | null;
  estimatedEmployeeAmountMinor: number | null;
  estimatedClientAmountMinor: number | null;
  currencyCode: string;
  punchState: string;
  displayStatus: ReviewDisplayStatus;
  approvedAt: string | null;
  additionalTimeApprovedAt: string | null;
  warnings: ReviewWarning[];
  canApproveShift: boolean;
  canApproveAdditionalTime: boolean;
  approvalBlockReasons: string[];
  punchTimeline?: Array<{
    id: string;
    action: string;
    eventUtc: string;
    isLate: boolean;
    isEarly: boolean;
    breakMinutes: number | null;
  }>;
};

export const REVIEW_STATUS_OPTIONS: Array<{ value: ReviewStatusFilter; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "needs_review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "incomplete", label: "Incomplete" },
  { value: "exceptions", label: "Exceptions" }
];

export const ESTIMATES_DISCLAIMER =
  "Amounts shown here are internal estimates only and are not payroll, invoices, tax calculations, or payments.";

export function formatReviewMinutes(minutes: number | null) {
  if (minutes === null) {
    return "—";
  }

  return `${minutes} min`;
}

export function formatReviewAmount(minorUnits: number | null, currencyCode = "USD") {
  if (minorUnits === null) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatReviewDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(iso));
}

export function formatReviewClockRange(
  clockInUtc: string | null,
  clockOutUtc: string | null,
  timeZone: string
) {
  if (!clockInUtc && !clockOutUtc) {
    return "—";
  }

  return formatShiftTimeRange(clockInUtc ?? clockOutUtc!, clockOutUtc ?? clockInUtc!, timeZone);
}

export function warningBadgeLabel(code: ReviewWarningCode) {
  switch (code) {
    case "late_clock_in":
      return "Late clock-in";
    case "early_clock_in":
      return "Early clock-in";
    case "break_short":
      return "Short break";
    case "break_long":
      return "Long break";
    case "additional_time_pending":
      return "Additional time";
    case "incomplete_shift":
      return "Incomplete";
    case "open_break":
      return "Open break";
    case "invalid_punch_sequence":
      return "Invalid sequence";
    case "missing_clock_in":
      return "Missing clock-in";
    case "missing_clock_out":
      return "Missing clock-out";
    default:
      return "Warning";
  }
}

export function warningBadgeTone(code: ReviewWarningCode) {
  if (["missing_clock_in", "missing_clock_out", "open_break", "invalid_punch_sequence", "incomplete_shift"].includes(code)) {
    return "danger" as const;
  }

  if (code === "additional_time_pending") {
    return "attention" as const;
  }

  return "warning" as const;
}

export function reviewStatusLabel(status: ReviewDisplayStatus) {
  switch (status) {
    case "approved":
      return "Approved";
    case "needs_review":
      return "Needs review";
    case "incomplete":
      return "Incomplete";
    default:
      return status;
  }
}

export function filterReviewShiftsByQuery(shifts: ReviewShiftRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return shifts;
  }

  return shifts.filter((shift) => {
    const haystack = [
      shift.employee.fullName,
      shift.serviceClient.name,
      shift.location.name
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function groupReviewShiftsByDate(shifts: ReviewShiftRecord[]) {
  const groups = new Map<string, ReviewShiftRecord[]>();

  for (const shift of shifts) {
    const key = shift.scheduledStartUtc.slice(0, 10);
    const existing = groups.get(key) ?? [];
    existing.push(shift);
    groups.set(key, existing);
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
}

export function punchActionLabel(action: string) {
  switch (action) {
    case "CLOCK_IN":
      return "Clock in";
    case "BREAK_START":
      return "Break start";
    case "BREAK_END":
      return "Break end";
    case "CLOCK_OUT":
      return "Clock out";
    default:
      return action;
  }
}
