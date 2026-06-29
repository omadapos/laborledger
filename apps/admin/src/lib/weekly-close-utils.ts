export type WeeklyPeriodStatus = "OPEN" | "CLOSED" | "REOPENED";

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

export type WeeklyCloseSummary = {
  company: { id: string; name: string };
  weekStartLocalDate: string;
  weekEndLocalDate: string;
  targetPayDate: string;
  closeTimeZone: string;
  locationsIncluded: Array<{ id: string; name: string }>;
  status: WeeklyPeriodStatus;
  overtimeEnabled: boolean;
  totals: {
    approvedShiftCount: number;
    incompleteShiftCount: number;
    unresolvedCorrectionCount: number;
    pendingAdditionalTimeCount: number;
    payableMinutes: number;
    employeeGrossEstimateMinor: number;
    clientLaborEstimateMinor: number;
    grossMarginEstimateMinor: number;
    currencyCode: string;
  };
  blockers: WeeklyBlocker[];
  canClose: boolean;
  canReopen: boolean;
  weeklyPeriodId: string | null;
  closedAt: string | null;
  closedBy: { id: string; label: string } | null;
  reopenedAt: string | null;
  reopenedBy: { id: string; label: string } | null;
  reopenReason: string | null;
  latestSnapshot: {
    id: string;
    version: number;
    approvedShiftCount: number;
    payableMinutes: number;
    employeeGrossEstimateMinor: number;
    clientLaborEstimateMinor: number;
    grossMarginEstimateMinor: number;
    createdAt: string;
    createdBy: { id: string; label: string };
  } | null;
  snapshotHistory: Array<{
    id: string;
    version: number;
    approvedShiftCount: number;
    payableMinutes: number;
    employeeGrossEstimateMinor: number;
    clientLaborEstimateMinor: number;
    grossMarginEstimateMinor: number;
    createdAt: string;
    createdBy: { id: string; label: string };
  }>;
};

export const WEEKLY_CLOSE_DISCLAIMER =
  "Closed weekly snapshots are immutable. Amounts shown are internal estimates only and are not payroll, invoices, tax calculations, or payments.";

export const ESTIMATES_DISCLAIMER =
  "Amounts shown here are internal estimates only and are not payroll, invoices, tax calculations, or payments.";

export function weeklyStatusLabel(status: WeeklyPeriodStatus) {
  if (status === "CLOSED") return "Closed";
  if (status === "REOPENED") return "Reopened";
  return "Open";
}

export function weeklyStatusBadgeClass(status: WeeklyPeriodStatus) {
  if (status === "CLOSED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "REOPENED") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function blockerTypeLabel(code: WeeklyBlockerCode) {
  const labels: Record<WeeklyBlockerCode, string> = {
    missing_clock_in: "Missing clock-in",
    missing_clock_out: "Missing clock-out",
    open_break: "Open break",
    invalid_punch_sequence: "Invalid punch sequence",
    pending_additional_time: "Pending additional time",
    pending_correction: "Pending correction",
    unapproved_shift: "Unapproved shift",
    unresolved_exception: "Unresolved exception"
  };

  return labels[code];
}

export function groupBlockersByType(blockers: WeeklyBlocker[]) {
  const groups = new Map<WeeklyBlockerCode, WeeklyBlocker[]>();

  for (const blocker of blockers) {
    const existing = groups.get(blocker.code) ?? [];
    existing.push(blocker);
    groups.set(blocker.code, existing);
  }

  return [...groups.entries()].map(([code, items]) => ({ code, items }));
}

export function formatWeekRange(weekStart: string, weekEnd: string) {
  return `${weekStart} – ${weekEnd}`;
}

export function formatPayableHours(payableMinutes: number) {
  const hours = Math.floor(payableMinutes / 60);
  const minutes = payableMinutes % 60;
  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatEstimateAmount(minorUnits: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function blockerReviewHref(blocker: WeeklyBlocker, companyId: string, weekStart: string) {
  if (blocker.code === "pending_correction" && blocker.correctionId) {
    return `/corrections?companyId=${companyId}&weekStart=${weekStart}`;
  }

  return `/review?companyId=${companyId}&weekStart=${weekStart}`;
}

export function validateReopenReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) {
    return "Reopen reason is required.";
  }

  if (trimmed.length < 8) {
    return "Provide a brief explanation of at least 8 characters.";
  }

  return null;
}
