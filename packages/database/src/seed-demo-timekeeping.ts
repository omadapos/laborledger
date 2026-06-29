import { PunchAction, ShiftStatus, type Prisma } from "@prisma/client";

type ZonedDateParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

type DemoShiftPunchPlan = {
  readonly clockInHour: number;
  readonly clockInMinute: number;
  readonly breakStartHour: number;
  readonly breakStartMinute: number;
  readonly breakEndHour: number;
  readonly breakEndMinute: number;
  readonly breakMinutes: number;
  readonly clockOutHour: number;
  readonly clockOutMinute: number;
  readonly scheduleStartHour: number;
  readonly scheduleEndHour: number;
  readonly approve: boolean;
};

type DemoTimekeepingLocation = {
  readonly locationId: string;
  readonly serviceClientId: string;
};

type DemoTimekeepingEmployee = {
  readonly employeeId: string;
  readonly fullName: string;
};

export type DemoActiveTodayMode = "scheduled" | "clocked_in" | "on_break";

export type DemoTimekeepingSeedInput = {
  readonly groupId: string;
  readonly companyId: string;
  readonly kioskId: string;
  readonly approvedByUserId: string;
  readonly timezone: string;
  readonly employees: readonly DemoTimekeepingEmployee[];
  readonly locations: readonly DemoTimekeepingLocation[];
  readonly workDays?: number;
  /** Weeks relative to the current Monday in the location time zone (0 = this week, -1 = prior week). */
  readonly weekStartOffset?: number;
  /** Employees who receive a partial punch sequence today instead of a completed shift. */
  readonly activeTodayEmployeeIds?: readonly string[];
  readonly activeTodayModes?: Readonly<Record<string, DemoActiveTodayMode>>;
};

export type DemoTimekeepingSeedResult = {
  readonly weekStartLocalDate: string;
  readonly shiftCount: number;
  readonly approvedShiftCount: number;
  readonly punchEventCount: number;
};

const DEFAULT_WORK_DAYS = 7;

/** 8:00–16:30 with a 30-minute break → 8 worked hours (480 minutes). */
const STANDARD_DAY: DemoShiftPunchPlan = {
  scheduleStartHour: 8,
  scheduleEndHour: 17,
  clockInHour: 8,
  clockInMinute: 0,
  breakStartHour: 12,
  breakStartMinute: 0,
  breakEndHour: 12,
  breakEndMinute: 30,
  breakMinutes: 30,
  clockOutHour: 16,
  clockOutMinute: 30,
  approve: true
};

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const diff = targetMs - actualMs;

    if (diff === 0) {
      break;
    }

    utcMs += diff;
  }

  return new Date(utcMs);
}

function addCalendarDays(parts: ZonedDateParts, days: number): ZonedDateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function formatLocalDateKey(parts: ZonedDateParts) {
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return `${parts.year}-${month}-${day}`;
}

function getMondayWeekStartInTimeZone(timeZone: string, reference = new Date()): ZonedDateParts {
  for (let offset = 0; offset < 7; offset += 1) {
    const probe = new Date(reference.getTime() - offset * 86_400_000);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(probe);

    if (weekday === "Mon") {
      const parts = getZonedParts(probe, timeZone);
      return { year: parts.year, month: parts.month, day: parts.day };
    }
  }

  throw new Error(`Could not resolve Monday for time zone ${timeZone}.`);
}

function resolvePunchPlan(
  employeeName: string,
  dayIndex: number,
  weekStartOffset: number
): DemoShiftPunchPlan {
  if (employeeName === "Deiber" && dayIndex === 2) {
    return {
      ...STANDARD_DAY,
      breakEndHour: 12,
      breakEndMinute: 20,
      breakMinutes: 20,
      approve: true
    };
  }

  if (employeeName === "Steven" && dayIndex === 4 && weekStartOffset === 0) {
    return {
      ...STANDARD_DAY,
      clockInHour: 8,
      clockInMinute: 6,
      approve: false
    };
  }

  return STANDARD_DAY;
}

type DemoShiftSeedContext = {
  groupId: string;
  companyId: string;
  employeeId: string;
  kioskId: string;
  locationId: string;
  serviceClientId: string;
  timezone: string;
  localDateKey: string;
  scheduleStartHour: number;
  scheduleEndHour: number;
};

async function findOrCreateDemoShift(
  tx: Prisma.TransactionClient,
  input: DemoShiftSeedContext
) {
  const [year, month, day] = input.localDateKey.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid local date key ${input.localDateKey}.`);
  }

  const scheduledStartUtc = localDateTimeToUtc(
    year,
    month,
    day,
    input.scheduleStartHour,
    0,
    input.timezone
  );
  const scheduledEndUtc = localDateTimeToUtc(
    year,
    month,
    day,
    input.scheduleEndHour,
    0,
    input.timezone
  );
  const planningKey = `demo-tk:${input.companyId}:${input.employeeId}:${input.localDateKey}`;
  const dayStartUtc = localDateTimeToUtc(year, month, day, 0, 0, input.timezone);
  const nextDay = addCalendarDays({ year, month, day }, 1);
  const dayEndUtc = localDateTimeToUtc(
    nextDay.year,
    nextDay.month,
    nextDay.day,
    0,
    0,
    input.timezone
  );

  let shift = await tx.shift.findUnique({
    where: { planningKey }
  });

  if (!shift) {
    shift = await tx.shift.findFirst({
      where: {
        companyId: input.companyId,
        employeeId: input.employeeId,
        status: ShiftStatus.SCHEDULED,
        scheduledStartUtc: {
          gte: dayStartUtc,
          lt: dayEndUtc
        }
      },
      orderBy: { scheduledStartUtc: "asc" }
    });
  }

  if (shift) {
    return tx.shift.update({
      where: { id: shift.id },
      data: {
        groupId: input.groupId,
        locationId: input.locationId,
        serviceClientId: input.serviceClientId,
        scheduledStartUtc,
        scheduledEndUtc,
        timezone: input.timezone,
        planningKey
      }
    });
  }

  return tx.shift.create({
    data: {
      groupId: input.groupId,
      companyId: input.companyId,
      locationId: input.locationId,
      employeeId: input.employeeId,
      serviceClientId: input.serviceClientId,
      status: ShiftStatus.SCHEDULED,
      scheduledStartUtc,
      scheduledEndUtc,
      timezone: input.timezone,
      planningKey
    }
  });
}

async function ensureCompletedDemoShift(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    employeeId: string;
    employeeName: string;
    kioskId: string;
    locationId: string;
    serviceClientId: string;
    timezone: string;
    localDateKey: string;
    dayIndex: number;
    weekStartOffset: number;
    approvedByUserId: string;
  }
) {
  const plan = resolvePunchPlan(input.employeeName, input.dayIndex, input.weekStartOffset);
  const [year, month, day] = input.localDateKey.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid local date key ${input.localDateKey}.`);
  }

  const shift = await findOrCreateDemoShift(tx, {
    groupId: input.groupId,
    companyId: input.companyId,
    employeeId: input.employeeId,
    kioskId: input.kioskId,
    locationId: input.locationId,
    serviceClientId: input.serviceClientId,
    timezone: input.timezone,
    localDateKey: input.localDateKey,
    scheduleStartHour: plan.scheduleStartHour,
    scheduleEndHour: plan.scheduleEndHour
  });

  const scheduledEndUtc = localDateTimeToUtc(
    year,
    month,
    day,
    plan.scheduleEndHour,
    0,
    input.timezone
  );

  const punchSpecs = [
    {
      action: PunchAction.CLOCK_IN,
      hour: plan.clockInHour,
      minute: plan.clockInMinute,
      breakMinutes: null as number | null
    },
    {
      action: PunchAction.BREAK_START,
      hour: plan.breakStartHour,
      minute: plan.breakStartMinute,
      breakMinutes: null
    },
    {
      action: PunchAction.BREAK_END,
      hour: plan.breakEndHour,
      minute: plan.breakEndMinute,
      breakMinutes: plan.breakMinutes
    },
    {
      action: PunchAction.CLOCK_OUT,
      hour: plan.clockOutHour,
      minute: plan.clockOutMinute,
      breakMinutes: null
    }
  ] as const;

  let punchEventCount = 0;

  for (const punch of punchSpecs) {
    const idempotencyKey = `demo-tk-punch:${shift.id}:${punch.action.toLowerCase()}`;
    const existing = await tx.punchEvent.findUnique({
      where: { idempotencyKey }
    });

    if (existing) {
      continue;
    }

    const eventUtc = localDateTimeToUtc(year, month, day, punch.hour, punch.minute, input.timezone);

    await tx.punchEvent.create({
      data: {
        groupId: input.groupId,
        companyId: input.companyId,
        shiftId: shift.id,
        employeeId: input.employeeId,
        kioskId: input.kioskId,
        action: punch.action,
        eventUtc,
        serverReceivedUtc: eventUtc,
        idempotencyKey,
        breakMinutes: punch.breakMinutes
      }
    });
    punchEventCount += 1;
  }

  if (plan.approve && !shift.approvedAt) {
    await tx.shift.update({
      where: { id: shift.id },
      data: {
        approvedAt: scheduledEndUtc,
        approvedByUserId: input.approvedByUserId
      }
    });
  }

  return {
    shiftId: shift.id,
    approved: plan.approve || shift.approvedAt !== null,
    punchEventCount
  };
}

async function ensureActiveDemoShift(
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    companyId: string;
    employeeId: string;
    kioskId: string;
    locationId: string;
    serviceClientId: string;
    timezone: string;
    localDateKey: string;
    mode: DemoActiveTodayMode;
  }
) {
  const plan = STANDARD_DAY;
  const scheduleEndHour = input.mode === "scheduled" ? 23 : plan.scheduleEndHour;
  const [year, month, day] = input.localDateKey.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid local date key ${input.localDateKey}.`);
  }

  const shift = await findOrCreateDemoShift(tx, {
    groupId: input.groupId,
    companyId: input.companyId,
    employeeId: input.employeeId,
    kioskId: input.kioskId,
    locationId: input.locationId,
    serviceClientId: input.serviceClientId,
    timezone: input.timezone,
    localDateKey: input.localDateKey,
    scheduleStartHour: plan.scheduleStartHour,
    scheduleEndHour
  });

  if (shift.approvedAt) {
    await tx.shift.update({
      where: { id: shift.id },
      data: {
        approvedAt: null,
        approvedByUserId: null,
        additionalTimeApprovedAt: null,
        additionalTimeApprovedByUserId: null
      }
    });
  }

  if (input.mode === "scheduled") {
    await tx.punchEvent.deleteMany({
      where: { shiftId: shift.id }
    });

    return {
      shiftId: shift.id,
      approved: false,
      punchEventCount: 0
    };
  }

  const allowedActions =
    input.mode === "on_break"
      ? new Set<PunchAction>([PunchAction.CLOCK_IN, PunchAction.BREAK_START])
      : new Set<PunchAction>([PunchAction.CLOCK_IN]);

  await tx.punchEvent.deleteMany({
    where: {
      shiftId: shift.id,
      action: { notIn: [...allowedActions] }
    }
  });

  const punchSpecs =
    input.mode === "on_break"
      ? ([
          { action: PunchAction.CLOCK_IN, hour: plan.clockInHour, minute: plan.clockInMinute, breakMinutes: null },
          {
            action: PunchAction.BREAK_START,
            hour: plan.breakStartHour,
            minute: plan.breakStartMinute,
            breakMinutes: null
          }
        ] as const)
      : ([
          { action: PunchAction.CLOCK_IN, hour: plan.clockInHour, minute: plan.clockInMinute, breakMinutes: null }
        ] as const);

  let punchEventCount = 0;

  for (const punch of punchSpecs) {
    const idempotencyKey = `demo-tk-punch:${shift.id}:${punch.action.toLowerCase()}`;
    const existing = await tx.punchEvent.findUnique({
      where: { idempotencyKey }
    });

    if (existing) {
      continue;
    }

    const eventUtc = localDateTimeToUtc(year, month, day, punch.hour, punch.minute, input.timezone);

    await tx.punchEvent.create({
      data: {
        groupId: input.groupId,
        companyId: input.companyId,
        shiftId: shift.id,
        employeeId: input.employeeId,
        kioskId: input.kioskId,
        action: punch.action,
        eventUtc,
        serverReceivedUtc: eventUtc,
        idempotencyKey,
        breakMinutes: punch.breakMinutes
      }
    });
    punchEventCount += 1;
  }

  return {
    shiftId: shift.id,
    approved: false,
    punchEventCount
  };
}

export async function ensureDemoTimekeepingWeek(
  tx: Prisma.TransactionClient,
  input: DemoTimekeepingSeedInput
): Promise<DemoTimekeepingSeedResult> {
  if (input.employees.length === 0) {
    return {
      weekStartLocalDate: formatLocalDateKey(getMondayWeekStartInTimeZone(input.timezone)),
      shiftCount: 0,
      approvedShiftCount: 0,
      punchEventCount: 0
    };
  }

  if (input.locations.length === 0) {
    throw new Error("Demo timekeeping seed requires at least one location.");
  }

  const weekStartOffset = input.weekStartOffset ?? 0;
  const weekStart = addCalendarDays(
    getMondayWeekStartInTimeZone(input.timezone),
    weekStartOffset * 7
  );
  const weekStartLocalDate = formatLocalDateKey(weekStart);
  const workDays = input.workDays ?? DEFAULT_WORK_DAYS;
  const todayKey = formatLocalDateKey(getZonedParts(new Date(), input.timezone));
  const activeTodayIds = new Set(input.activeTodayEmployeeIds ?? []);
  const activeTodayModes = input.activeTodayModes ?? {};

  let shiftCount = 0;
  let approvedShiftCount = 0;
  let punchEventCount = 0;

  for (let dayIndex = 0; dayIndex < workDays; dayIndex += 1) {
    const dayParts = addCalendarDays(weekStart, dayIndex);
    const localDateKey = formatLocalDateKey(dayParts);
    const location = input.locations[dayIndex % input.locations.length];
    if (!location) {
      continue;
    }

    for (const employee of input.employees) {
      if (localDateKey === todayKey && activeTodayIds.has(employee.employeeId)) {
        const result = await ensureActiveDemoShift(tx, {
          groupId: input.groupId,
          companyId: input.companyId,
          employeeId: employee.employeeId,
          kioskId: input.kioskId,
          locationId: location.locationId,
          serviceClientId: location.serviceClientId,
          timezone: input.timezone,
          localDateKey,
          mode: activeTodayModes[employee.employeeId] ?? "clocked_in"
        });

        shiftCount += 1;
        approvedShiftCount += result.approved ? 1 : 0;
        punchEventCount += result.punchEventCount;
        continue;
      }

      const result = await ensureCompletedDemoShift(tx, {
        groupId: input.groupId,
        companyId: input.companyId,
        employeeId: employee.employeeId,
        employeeName: employee.fullName,
        kioskId: input.kioskId,
        locationId: location.locationId,
        serviceClientId: location.serviceClientId,
        timezone: input.timezone,
        localDateKey,
        dayIndex,
        weekStartOffset,
        approvedByUserId: input.approvedByUserId
      });

      shiftCount += 1;
      approvedShiftCount += result.approved ? 1 : 0;
      punchEventCount += result.punchEventCount;
    }
  }

  return {
    weekStartLocalDate,
    shiftCount,
    approvedShiftCount,
    punchEventCount
  };
}
