import { formatShiftTimeRange } from "./shift-utils";

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED" | "APPLIED";

export type CorrectionType =
  | "MISSING_CLOCK_OUT"
  | "OPEN_BREAK_END"
  | "INCORRECT_CLOCK_IN"
  | "INCORRECT_CLOCK_OUT"
  | "INCORRECT_BREAK_START"
  | "INCORRECT_BREAK_END";

export type CorrectionSummary = {
  id: string;
  companyId: string;
  shiftId: string;
  employee: { id: string; fullName: string };
  location: { id: string; name: string; timezone: string };
  type: CorrectionType;
  typeLabel: string;
  status: CorrectionStatus;
  reason: string;
  requestedAt: string;
  requestedByLabel: string;
  scheduledStartUtc: string;
  shiftTimezone: string;
};

export type CorrectionDetail = CorrectionSummary & {
  originalPayload: Record<string, unknown>;
  proposedPayload: Record<string, unknown>;
  finalPayload: Record<string, unknown> | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  appliedAt: string | null;
  requestedBy: { id: string; fullName: string | null; email: string } | null;
  reviewedBy: { id: string; fullName: string | null; email: string } | null;
  appliedBy: { id: string; fullName: string | null; email: string } | null;
  shift: {
    id: string;
    scheduledStartUtc: string;
    scheduledEndUtc: string;
    timezone: string;
    approvedAt: string | null;
  };
  originalTimeline: Array<{
    id: string;
    action: string;
    eventUtc: string;
    source: "kiosk" | "correction";
    originalEventUtc: string | null;
  }>;
  workedMinuteImpact: {
    originalWorkedMinutes: number | null;
    proposedWorkedMinutes: number | null;
    originalPayableMinutes: number | null;
    proposedPayableMinutes: number | null;
    originalPunchState: string;
    proposedPunchState: string;
  } | null;
  canApprove: boolean;
  canReject: boolean;
  canApply: boolean;
};

export type CorrectionStatusFilter = "" | CorrectionStatus;

export type CorrectionTypeFilter = "" | CorrectionType;

export const CORRECTION_STATUS_OPTIONS: Array<{ value: CorrectionStatusFilter; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "APPLIED", label: "Applied" }
];

export const CORRECTION_TYPE_OPTIONS: Array<{ value: CorrectionTypeFilter; label: string }> = [
  { value: "", label: "All types" },
  { value: "MISSING_CLOCK_OUT", label: "Missing clock-out" },
  { value: "OPEN_BREAK_END", label: "Open break end" },
  { value: "INCORRECT_CLOCK_IN", label: "Incorrect clock-in" },
  { value: "INCORRECT_CLOCK_OUT", label: "Incorrect clock-out" },
  { value: "INCORRECT_BREAK_START", label: "Incorrect break start" },
  { value: "INCORRECT_BREAK_END", label: "Incorrect break end" }
];

export const CORRECTIONS_DISCLAIMER =
  "Corrections do not erase original kiosk events. Approved corrections store final values separately with actor, timestamp, and reason.";

export function correctionStatusLabel(status: CorrectionStatus) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "APPLIED":
      return "Applied";
    default:
      return status;
  }
}

export function formatCorrectionPayload(payload: Record<string, unknown>, timeZone: string) {
  const eventUtc = typeof payload.eventUtc === "string" ? payload.eventUtc : null;
  const action = typeof payload.action === "string" ? payload.action : null;
  const breakMinutes =
    typeof payload.breakMinutes === "number" ? `${payload.breakMinutes} min` : null;

  const parts = [
    action ? action.replaceAll("_", " ").toLowerCase() : null,
    eventUtc ? formatShiftTimeRange(eventUtc, eventUtc, timeZone) : null,
    breakMinutes
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function formatWorkedMinuteImpact(
  impact: CorrectionDetail["workedMinuteImpact"]
) {
  if (!impact) {
    return "—";
  }

  if (impact.originalWorkedMinutes === impact.proposedWorkedMinutes) {
    return `${impact.proposedWorkedMinutes ?? "—"} min`;
  }

  return `${impact.originalWorkedMinutes ?? "—"} → ${impact.proposedWorkedMinutes ?? "—"} min`;
}

export function filterCorrectionsByQuery(corrections: CorrectionSummary[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return corrections;
  }

  return corrections.filter((correction) => {
    const haystack = [
      correction.employee.fullName,
      correction.location.name,
      correction.typeLabel,
      correction.reason,
      correction.requestedByLabel
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function requiresPunchEventId(type: CorrectionType) {
  return type.startsWith("INCORRECT_");
}

export function formatCorrectionDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(iso));
}
