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

function formatDateKey(parts: Pick<ZonedParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getLocalWeekday(date: Date, timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return map[weekday] ?? 0;
}

export const DEFAULT_TIMEZONE = "America/New_York";

export function addDaysToDateKey(dateKey: string, days: number) {
  const parts = dateKey.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getMondayWeekStart(date = new Date()) {
  return getMondayWeekStartInTimeZone(date, DEFAULT_TIMEZONE);
}

export function getMondayWeekStartInTimeZone(instant: Date, timeZone: string) {
  let cursor = instant;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (getLocalWeekday(cursor, timeZone) === 1) {
      return formatDateKey(getZonedParts(cursor, timeZone));
    }

    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  return formatDateKey(getZonedParts(instant, timeZone));
}

export function computeWeekEndLocalDate(weekStartLocalDate: string) {
  return addDaysToDateKey(weekStartLocalDate, 6);
}

export function computeTargetPayDate(weekEndLocalDate: string) {
  return addDaysToDateKey(weekEndLocalDate, 5);
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

export function weekRangeToUtcBounds(weekStart: string, timeZone: string) {
  const weekEnd = addDaysToDateKey(weekStart, 7);
  return {
    from: localDateTimeInTimeZoneToUtcIso(weekStart, "00:00", timeZone),
    to: localDateTimeInTimeZoneToUtcIso(weekEnd, "00:00", timeZone)
  };
}

export function parseWeekStartLocalDate(weekStart?: string) {
  if (weekStart && /^\d{4}-\d{2}-\d{2}$/u.test(weekStart)) {
    return weekStart;
  }

  return getMondayWeekStart();
}

export function resolveCompanyCloseTimeZone(
  _locations: Array<{ timezone: string; archivedAt: Date | null }>
) {
  return DEFAULT_TIMEZONE;
}
