export type LaborWorkLogItem = {
  id: string;
  employeeName: string;
  clientName: string;
  address: string;
  serviceName: string;
  status: string;
  progressPercent: number;
  startedAt: string;
  completedAt: string | null;
  referencePrepMinutes: number | null;
  referenceWashMinutes: number | null;
  referenceServiceMinutes: number | null;
  notes: string | null;
  shiftScheduledStartUtc: string;
  shiftClockInUtc: string | null;
  billingSourceReminder: string;
};

export type LaborWorkLogResponse = {
  items: LaborWorkLogItem[];
  billingSourceReminder: string;
};

export const LABOR_WORK_LOG_DISCLAIMER =
  "Service times are reference only. Labor billing uses approved clock/punch hours.";

export function formatLaborWorkDuration(minutes: number | null) {
  if (minutes === null || minutes === undefined) {
    return "—";
  }
  return `${minutes} min`;
}

export function buildLaborWorkLogQuery(input: {
  locationId?: string;
  employeeId?: string;
  serviceClientId?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (input.locationId) params.set("locationId", input.locationId);
  if (input.employeeId) params.set("employeeId", input.employeeId);
  if (input.serviceClientId) params.set("serviceClientId", input.serviceClientId);
  if (input.status) params.set("status", input.status);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export type LaborWorkWeekSummary = {
  total: number;
  completed: number;
  blocked: number;
  inProgress: number;
};

export const EMPTY_LABOR_WORK_WEEK_SUMMARY: LaborWorkWeekSummary = {
  total: 0,
  completed: 0,
  blocked: 0,
  inProgress: 0
};

export function summarizeLaborWorkByStatus(items: Array<{ status: string }> = []): LaborWorkWeekSummary {
  return {
    total: items.length,
    completed: items.filter((item) => item.status === "COMPLETED").length,
    blocked: items.filter((item) => item.status === "BLOCKED").length,
    inProgress: items.filter((item) => item.status === "IN_PROGRESS").length
  };
}

export function buildLaborWorkContextHref(input: {
  companyId: string;
  periodStart: string;
  periodEnd: string;
  serviceClientId?: string;
  locationId?: string;
}) {
  const params = new URLSearchParams();
  params.set("companyId", input.companyId);
  params.set("from", input.periodStart);
  params.set("to", input.periodEnd);
  if (input.serviceClientId) {
    params.set("serviceClientId", input.serviceClientId);
  }
  if (input.locationId) {
    params.set("locationId", input.locationId);
  }
  return `/labor-work?${params.toString()}`;
}
