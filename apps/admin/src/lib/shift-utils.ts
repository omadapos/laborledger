import type { CompanyRecord } from "./employee-utils";

export type ShiftListRecord = {
  id: string;
  companyId: string;
  locationId: string;
  employeeId: string;
  serviceClientId: string;
  status: string;
  scheduledStartUtc: string;
  scheduledEndUtc: string;
  timezone: string;
  createdAt: string;
  updatedAt?: string;
  employee?: { id: string; fullName: string };
  location?: { id: string; name: string; timezone: string; serviceClientId: string };
  serviceClient?: { id: string; name: string };
};

export type ShiftViewRecord = ShiftListRecord & {
  displayDateKey: string;
  isOvernight: boolean;
};

export type { CompanyRecord };

export type EmployeeOption = {
  id: string;
  fullName: string;
  archivedAt: string | null;
};

export type ServiceClientOption = {
  id: string;
  name: string;
  archivedAt: string | null;
};

export type LocationOption = {
  id: string;
  name: string;
  timezone: string;
  serviceClientId: string;
  archivedAt: string | null;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second ?? "0")
  };
}

export function localDateTimeInTimeZoneToUtcIso(datePart: string, timePart: string, timeZone: string) {
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error("Invalid date or time.");
  }

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const actualMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMs += desiredMs - actualMs;
  }

  return new Date(utcMs).toISOString();
}

export function formatShiftLocalDate(value: string, timeZone: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function formatShiftLocalTime(value: string, timeZone: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

export function formatShiftTimeRange(startUtc: string, endUtc: string, timeZone: string) {
  return `${formatShiftLocalTime(startUtc, timeZone)} – ${formatShiftLocalTime(endUtc, timeZone)}`;
}

export function getShiftDisplayDateKey(startUtc: string, timeZone: string) {
  const parsed = new Date(startUtc);
  if (Number.isNaN(parsed.getTime())) {
    return "unknown";
  }

  const parts = getZonedParts(parsed, timeZone);
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

export function isOvernightShift(startUtc: string, endUtc: string, timeZone: string) {
  return getShiftDisplayDateKey(startUtc, timeZone) !== getShiftDisplayDateKey(endUtc, timeZone);
}

export function enrichShiftViews(shifts: ShiftListRecord[]): ShiftViewRecord[] {
  return shifts.map((shift) => ({
    ...shift,
    displayDateKey: getShiftDisplayDateKey(shift.scheduledStartUtc, shift.timezone),
    isOvernight: isOvernightShift(shift.scheduledStartUtc, shift.scheduledEndUtc, shift.timezone)
  }));
}

export function groupShiftsByStartDate(shifts: ShiftViewRecord[]) {
  const groups = new Map<string, ShiftViewRecord[]>();

  for (const shift of shifts) {
    const existing = groups.get(shift.displayDateKey) ?? [];
    existing.push(shift);
    groups.set(shift.displayDateKey, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, dateShifts]) => ({
      dateKey,
      label: formatShiftLocalDate(dateShifts[0]?.scheduledStartUtc ?? "", dateShifts[0]?.timezone ?? DEFAULT_TIMEZONE),
      shifts: dateShifts
    }));
}

export function formatShiftStatus(status: string) {
  if (status === "SCHEDULED") {
    return "Scheduled";
  }

  if (status === "CANCELLED") {
    return "Cancelled";
  }

  return status;
}

export const DEFAULT_TIMEZONE = "America/New_York";

export function getMondayWeekStart(date = new Date()) {
  return getMondayWeekStartInTimeZone(DEFAULT_TIMEZONE, date);
}

/** Monday of the workweek containing `reference`, in the given IANA time zone (matches backend close TZ). */
export function getMondayWeekStartInTimeZone(timeZone: string, reference = new Date()) {
  for (let offset = 0; offset < 7; offset += 1) {
    const probe = new Date(reference.getTime() - offset * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(probe);

    if (weekday === "Mon") {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(probe);

      const year = Number(parts.find((part) => part.type === "year")?.value);
      const month = Number(parts.find((part) => part.type === "month")?.value);
      const day = Number(parts.find((part) => part.type === "day")?.value);

      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return getMondayWeekStartUtc(reference);
}

function getMondayWeekStartUtc(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + diff);
  return utc.toISOString().slice(0, 10);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const parts = dateKey.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekRangeToUtcBounds(weekStart: string, timeZone: string) {
  const weekEnd = addDaysToDateKey(weekStart, 7);
  return {
    from: localDateTimeInTimeZoneToUtcIso(weekStart, "00:00", timeZone),
    to: localDateTimeInTimeZoneToUtcIso(weekEnd, "00:00", timeZone)
  };
}

export function filterShiftsByQuery(shifts: ShiftViewRecord[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return shifts;
  }

  return shifts.filter((shift) => {
    const haystack = [
      shift.employee?.fullName,
      shift.serviceClient?.name,
      shift.location?.name,
      shift.timezone
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export type ShiftFormFieldErrors = {
  employeeId?: string;
  serviceClientId?: string;
  locationId?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
};

export function validateShiftForm(input: {
  employeeId: string;
  serviceClientId: string;
  locationId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timeZone: string;
}) {
  const errors: ShiftFormFieldErrors = {};

  if (!input.employeeId) {
    errors.employeeId = "Employee is required.";
  }

  if (!input.serviceClientId) {
    errors.serviceClientId = "Service client is required.";
  }

  if (!input.locationId) {
    errors.locationId = "Location is required.";
  }

  if (!input.startDate) {
    errors.startDate = "Start date is required.";
  }

  if (!input.startTime) {
    errors.startTime = "Start time is required.";
  }

  if (!input.endDate) {
    errors.endDate = "End date is required.";
  }

  if (!input.endTime) {
    errors.endTime = "End time is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors, startUtc: null as string | null, endUtc: null as string | null };
  }

  try {
    const startUtc = localDateTimeInTimeZoneToUtcIso(input.startDate, input.startTime, input.timeZone);
    const endUtc = localDateTimeInTimeZoneToUtcIso(input.endDate, input.endTime, input.timeZone);

    if (new Date(endUtc).getTime() <= new Date(startUtc).getTime()) {
      errors.endTime = "End must be after start.";
    }

    return { errors, startUtc, endUtc };
  } catch {
    errors.startDate = "Enter valid date and time values for the location time zone.";
    return { errors, startUtc: null, endUtc: null };
  }
}

export function formatDateKeyLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DEFAULT_TIMEZONE
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function resolveWeekFilterTimeZone(_locations?: LocationOption[], _locationFilter?: string) {
  return DEFAULT_TIMEZONE;
}

export type ScheduleConflictRecord = {
  employeeId: string;
  employeeName: string | null;
  conflictingShiftId: string;
  scheduledStart: string;
  scheduledEnd: string;
  locationName: string | null;
  reason: string;
};

export type CopyWeekResultRecord = {
  created: Array<{
    shiftId: string;
    employeeId: string;
    employeeName: string | null;
    scheduledStartUtc: string;
    scheduledEndUtc: string;
  }>;
  skipped: Array<{ sourceShiftId: string; reason: string }>;
  conflicts: ScheduleConflictRecord[];
  summary: {
    createdCount: number;
    skippedCount: number;
    conflictCount: number;
  };
};

export function validateCancelReason(reason: string) {
  const trimmed = reason.trim();
  if (!trimmed) {
    return "Cancel reason is required.";
  }

  if (trimmed.length < 3) {
    return "Cancel reason must be at least 3 characters.";
  }

  return null;
}

export function validateCopyWeekForm(input: { sourceWeekStart: string; targetWeekStart: string }) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/u;
  if (!datePattern.test(input.sourceWeekStart)) {
    return "Source week must be a valid date.";
  }

  if (!datePattern.test(input.targetWeekStart)) {
    return "Target week must be a valid date.";
  }

  if (input.sourceWeekStart === input.targetWeekStart) {
    return "Target week must differ from source week.";
  }

  return null;
}

export function buildShiftsListQuery(input: {
  from: string;
  to: string;
  locationId?: string;
  employeeId?: string;
  includeCancelled?: boolean;
}) {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  if (input.locationId) {
    params.set("locationId", input.locationId);
  }
  if (input.employeeId) {
    params.set("employeeId", input.employeeId);
  }
  if (input.includeCancelled) {
    params.set("includeCancelled", "true");
  }

  return params.toString();
}

export function formatCopyWeekSummary(result: CopyWeekResultRecord) {
  const { createdCount, skippedCount, conflictCount } = result.summary;
  return `Created ${createdCount}, skipped ${skippedCount}, conflicts ${conflictCount}.`;
}

export function formatScheduleConflict(conflict: ScheduleConflictRecord) {
  const employee = conflict.employeeName ?? conflict.employeeId;
  const location = conflict.locationName ? ` at ${conflict.locationName}` : "";
  return `${employee}${location}: ${conflict.reason}`;
}

export function shiftUtcBoundsToFormParts(startUtc: string, endUtc: string, timeZone: string) {
  const toLocal = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(value));
    const lookup = Object.fromEntries(
      parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
    );
    return {
      date: `${lookup.year}-${lookup.month}-${lookup.day}`,
      time: `${lookup.hour}:${lookup.minute}`
    };
  };

  const start = toLocal(startUtc);
  const end = toLocal(endUtc);
  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time
  };
}
