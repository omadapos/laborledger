import { BadRequestException } from "@nestjs/common";
import type { Prisma, Shift } from "@prisma/client";
import { ShiftStatus } from "@prisma/client";

import {
  addDaysToDateKey,
  localDateTimeInTimeZoneToUtcIso,
  weekRangeToUtcBounds
} from "../../weekly-close/week-period";

import type { ShiftScheduleConflict } from "./shift-scheduling.types";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
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
    minute: Number(lookup.minute)
  };
}

function formatDateKey(parts: Pick<ZonedParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function formatTimeKey(parts: Pick<ZonedParts, "hour" | "minute">) {
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function parseWeekStartDateKey(value: string, fieldName: string) {
  const trimmed = value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(trimmed)) {
    throw new BadRequestException(`${fieldName} must be a YYYY-MM-DD date.`);
  }

  return trimmed;
}

export function daysBetweenDateKeys(fromDateKey: string, toDateKey: string) {
  const fromParts = fromDateKey.split("-").map(Number);
  const toParts = toDateKey.split("-").map(Number);
  const fromMs = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const toMs = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((toMs - fromMs) / 86_400_000);
}

export function getShiftLocalSchedule(shift: Pick<Shift, "scheduledStartUtc" | "scheduledEndUtc" | "timezone">) {
  const startParts = getZonedParts(shift.scheduledStartUtc, shift.timezone);
  const endParts = getZonedParts(shift.scheduledEndUtc, shift.timezone);

  return {
    startDateKey: formatDateKey(startParts),
    startTime: formatTimeKey(startParts),
    endDateKey: formatDateKey(endParts),
    endTime: formatTimeKey(endParts)
  };
}

export function mapShiftToTargetWeek(
  shift: Pick<Shift, "scheduledStartUtc" | "scheduledEndUtc" | "timezone">,
  sourceWeekStart: string,
  targetWeekStart: string
) {
  const local = getShiftLocalSchedule(shift);
  const startDayOffset = daysBetweenDateKeys(sourceWeekStart, local.startDateKey);
  const endDayOffset = daysBetweenDateKeys(sourceWeekStart, local.endDateKey);
  const targetStartDate = addDaysToDateKey(targetWeekStart, startDayOffset);
  const targetEndDate = addDaysToDateKey(targetWeekStart, endDayOffset);

  return {
    scheduledStartUtc: new Date(
      localDateTimeInTimeZoneToUtcIso(targetStartDate, local.startTime, shift.timezone)
    ),
    scheduledEndUtc: new Date(localDateTimeInTimeZoneToUtcIso(targetEndDate, local.endTime, shift.timezone))
  };
}

export function buildCopyWeekOperationKey(input: {
  companyId: string;
  sourceWeekStart: string;
  targetWeekStart: string;
  locationId?: string;
  employeeId?: string;
  serviceClientId?: string;
}) {
  return [
    "copy-week",
    input.companyId,
    input.sourceWeekStart,
    input.targetWeekStart,
    input.locationId ?? "",
    input.employeeId ?? "",
    input.serviceClientId ?? ""
  ].join(":");
}

export function buildCopyWeekPlanningKey(operationKey: string, sourceShiftId: string) {
  return `${operationKey}:${sourceShiftId}`;
}

export function weekBoundsForFilter(weekStart: string, timeZone: string) {
  return weekRangeToUtcBounds(weekStart, timeZone);
}

type ShiftWithPunchProbe = Pick<
  Shift,
  | "id"
  | "companyId"
  | "status"
  | "cancelledAt"
  | "approvedAt"
  | "scheduledStartUtc"
  | "scheduledEndUtc"
  | "timezone"
> & {
  punchEvents: Array<{ id: string }>;
};

export function assertShiftMutableForScheduling(shift: ShiftWithPunchProbe) {
  if (shift.status !== ShiftStatus.SCHEDULED) {
    throw new BadRequestException("Only scheduled shifts can be changed.");
  }

  if (shift.cancelledAt) {
    throw new BadRequestException("Cancelled shifts cannot be changed.");
  }

  if (shift.approvedAt) {
    throw new BadRequestException("Approved shifts cannot be changed.");
  }

  if (shift.punchEvents.length > 0) {
    throw new BadRequestException("Shifts with punch activity cannot be changed.");
  }
}

export function toShiftScheduleConflict(
  overlap: {
    id: string;
    scheduledStartUtc: Date;
    scheduledEndUtc: Date;
    employeeId: string;
    employee?: { fullName: string } | null;
    location?: { name: string } | null;
  },
  reason: string
): ShiftScheduleConflict {
  return {
    employeeId: overlap.employeeId,
    employeeName: overlap.employee?.fullName ?? null,
    conflictingShiftId: overlap.id,
    scheduledStart: overlap.scheduledStartUtc.toISOString(),
    scheduledEnd: overlap.scheduledEndUtc.toISOString(),
    locationName: overlap.location?.name ?? null,
    reason
  };
}

export type ShiftOverlapWhere = Prisma.ShiftWhereInput;

export function buildShiftOverlapWhere(input: {
  companyId: string;
  employeeId: string;
  scheduledStartUtc: Date;
  scheduledEndUtc: Date;
  excludeShiftId?: string;
}): ShiftOverlapWhere {
  return {
    companyId: input.companyId,
    employeeId: input.employeeId,
    status: ShiftStatus.SCHEDULED,
    ...(input.excludeShiftId ? { id: { not: input.excludeShiftId } } : {}),
    scheduledStartUtc: { lt: input.scheduledEndUtc },
    scheduledEndUtc: { gt: input.scheduledStartUtc }
  };
}
