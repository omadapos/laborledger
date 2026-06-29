import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import * as argon2 from "argon2";
import { PunchAction, ShiftStatus } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";
import { LaborWorkAssignmentService } from "../labor-work-assignment/labor-work-assignment.service";

import type { KioskContext } from "./kiosk-auth.guard";
import {
  allowedActions,
  buildBreakWarnings,
  calculateWorkedMinutes,
  canApplyPunchAction,
  countBreakStarts,
  derivePunchState,
  evaluateClockInTiming,
  invalidTransitionMessage,
  mapPunchAction,
  mapPunchStateToResponse,
  minutesBetween,
  type PunchEventRecord
} from "./punch-state";

type PunchRequest = {
  pin: string;
  action: string;
  idempotencyKey: string;
  deviceEventId?: string;
  deviceTimestamp?: string;
  sequence?: number;
};

type LookupRequest = {
  pin: string;
};

@Injectable()
export class KioskPunchService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LaborWorkAssignmentService)
    private readonly laborWorkAssignmentService: LaborWorkAssignmentService
  ) {}

  async lookup(kiosk: KioskContext, input: LookupRequest) {
    const pin = input.pin ?? "";
    if (!/^\d{6}$/u.test(pin)) {
      throw new BadRequestException("Employee PIN must be exactly 6 digits.");
    }

    const employee = await this.resolveEmployeeByPin(kiosk.companyId, pin);
    const shift = await this.resolveShiftForLookup(kiosk, employee.id);

    return this.buildSessionResponse(shift, employee, []);
  }

  async processPunch(kiosk: KioskContext, input: PunchRequest) {
    const idempotencyKey = input.idempotencyKey?.trim() ?? "";
    const pin = input.pin ?? "";
    const action = mapPunchAction(input.action?.trim() ?? "");

    if (!idempotencyKey) {
      throw new BadRequestException("idempotencyKey is required.");
    }

    if (!/^\d{6}$/u.test(pin)) {
      throw new BadRequestException("Employee PIN must be exactly 6 digits.");
    }

    if (!action) {
      throw new BadRequestException("Unsupported punch action.");
    }

    const existing = await this.prisma.punchEvent.findUnique({
      where: { idempotencyKey },
      include: {
        employee: { select: { id: true, fullName: true } },
        shift: {
          include: {
            punchEvents: {
              orderBy: [{ eventUtc: "asc" }, { serverReceivedUtc: "asc" }]
            }
          }
        }
      }
    });

    if (existing) {
      if (existing.kioskId !== kiosk.id) {
        throw new BadRequestException("Idempotency key was already used for a different kiosk.");
      }

      return this.buildSessionResponse(existing.shift, existing.employee, [], true);
    }

    const employee = await this.resolveEmployeeByPin(kiosk.companyId, pin);

    if (employee.companyId !== kiosk.companyId) {
      throw new ForbiddenException("Employee does not belong to this kiosk company.");
    }

    const now = new Date();
    const shift = await this.resolveShift(kiosk, employee.id, action, now);
    const events = this.toEventRecords(shift.punchEvents);
    const currentState = derivePunchState(events);
    const breakCount = countBreakStarts(events);

    if (!canApplyPunchAction(currentState, action, breakCount)) {
      throw new BadRequestException(invalidTransitionMessage(currentState, action, breakCount));
    }

    if (action === PunchAction.CLOCK_OUT) {
      await this.laborWorkAssignmentService.assertNoActiveWorkForClockOut(
        kiosk.companyId,
        employee.id
      );
    }

    let isLate = false;
    let isEarly = false;
    let breakMinutes: number | null = null;
    const warnings: string[] = [];

    if (action === PunchAction.CLOCK_IN) {
      const timing = evaluateClockInTiming({
        now,
        scheduledStartUtc: shift.scheduledStartUtc,
        scheduledEndUtc: shift.scheduledEndUtc
      });

      if (!timing.allowed) {
        throw new BadRequestException(timing.reason);
      }

      isLate = timing.isLate;
      isEarly = timing.isEarly;

      if (isLate) {
        warnings.push("Clock-in is late.");
      }

      if (isEarly) {
        warnings.push("Early clock-in minutes are included and flagged for review.");
      }
    }

    if (action === PunchAction.BREAK_END) {
      const breakStart = [...events].reverse().find((event) => event.action === PunchAction.BREAK_START);
      if (!breakStart) {
        throw new BadRequestException("Break end requires an active break.");
      }

      breakMinutes = minutesBetween(breakStart.eventUtc, now);
      warnings.push(...buildBreakWarnings(breakMinutes));
    }

    const deviceTimestamp = input.deviceTimestamp ? new Date(input.deviceTimestamp) : null;
    if (deviceTimestamp && Number.isNaN(deviceTimestamp.getTime())) {
      throw new BadRequestException("deviceTimestamp must be a valid ISO-8601 instant.");
    }

    await this.prisma.punchEvent.create({
      data: {
        groupId: kiosk.groupId,
        companyId: kiosk.companyId,
        shiftId: shift.id,
        employeeId: employee.id,
        kioskId: kiosk.id,
        action,
        eventUtc: now,
        serverReceivedUtc: now,
        idempotencyKey,
        deviceEventId: input.deviceEventId?.trim() || null,
        deviceTimestamp,
        sequence: input.sequence ?? null,
        isLate,
        isEarly,
        breakMinutes
      }
    });

    const updatedShift = await this.prisma.shift.findUniqueOrThrow({
      where: { id: shift.id },
      include: {
        punchEvents: {
          orderBy: [{ eventUtc: "asc" }, { serverReceivedUtc: "asc" }]
        }
      }
    });

    const responseWarnings = [...warnings];
    const updatedEvents = this.toEventRecords(updatedShift.punchEvents);
    const updatedState = derivePunchState(updatedEvents);

    if (updatedState === "clocked_out") {
      const workedMinutes = calculateWorkedMinutes(updatedEvents);
      if (workedMinutes !== null) {
        const clockOut = [...updatedEvents]
          .reverse()
          .find((event) => event.action === PunchAction.CLOCK_OUT);
        if (clockOut && clockOut.eventUtc.getTime() > shift.scheduledEndUtc.getTime()) {
          const pendingAdditionalMinutes = minutesBetween(shift.scheduledEndUtc, clockOut.eventUtc);
          responseWarnings.push(
            `${pendingAdditionalMinutes} minutes after scheduled end are pending approval.`
          );
        }
      }
    }

    return this.buildSessionResponse(updatedShift, employee, responseWarnings);
  }

  private async resolveEmployeeByPin(companyId: string, pin: string) {
    const credentials = await this.prisma.employeePinCredential.findMany({
      where: {
        companyId,
        revokedAt: null,
        employee: {
          archivedAt: null
        }
      },
      include: {
        employee: true
      }
    });

    for (const credential of credentials) {
      const matches = await argon2.verify(credential.pinHash, pin);
      if (matches) {
        return credential.employee;
      }
    }

    throw new UnauthorizedException("PIN is invalid for this company.");
  }

  private async resolveShiftForLookup(kiosk: KioskContext, employeeId: string) {
    const activeShifts = await this.prisma.shift.findMany({
      where: {
        employeeId,
        locationId: kiosk.locationId,
        companyId: kiosk.companyId,
        status: ShiftStatus.SCHEDULED,
        cancelledAt: null
      },
      include: {
        punchEvents: {
          orderBy: [{ eventUtc: "asc" }, { serverReceivedUtc: "asc" }]
        }
      },
      orderBy: { scheduledStartUtc: "desc" }
    });

    for (const shift of activeShifts) {
      const state = derivePunchState(this.toEventRecords(shift.punchEvents));
      if (state !== "clocked_out") {
        return shift;
      }
    }

    const now = new Date();
    const upcoming = activeShifts.find(
      (shift) =>
        derivePunchState(this.toEventRecords(shift.punchEvents)) === "scheduled" &&
        shift.scheduledEndUtc.getTime() >= now.getTime()
    );

    if (upcoming) {
      return upcoming;
    }

    throw new NotFoundException("No eligible scheduled shift was found for this employee and location.");
  }

  private async resolveShift(
    kiosk: KioskContext,
    employeeId: string,
    action: PunchAction,
    now: Date
  ) {
    if (action === PunchAction.CLOCK_IN) {
      const candidates = await this.prisma.shift.findMany({
        where: {
          employeeId,
          locationId: kiosk.locationId,
          companyId: kiosk.companyId,
          status: ShiftStatus.SCHEDULED,
          cancelledAt: null
        },
        include: {
          punchEvents: {
            orderBy: [{ eventUtc: "asc" }, { serverReceivedUtc: "asc" }]
          }
        },
        orderBy: { scheduledStartUtc: "asc" }
      });

      let hasNonScheduledShift = false;

      for (const candidate of candidates) {
        const state = derivePunchState(this.toEventRecords(candidate.punchEvents));
        if (state !== "scheduled") {
          hasNonScheduledShift = true;
          continue;
        }

        if (now.getTime() <= candidate.scheduledEndUtc.getTime()) {
          return candidate;
        }

        return candidate;
      }

      if (hasNonScheduledShift) {
        throw new BadRequestException("Clock-in is not allowed for the current punch state.");
      }

      throw new NotFoundException("No eligible scheduled shift was found for this employee and location.");
    }

    const activeShifts = await this.prisma.shift.findMany({
      where: {
        employeeId,
        locationId: kiosk.locationId,
        companyId: kiosk.companyId,
        status: ShiftStatus.SCHEDULED,
        cancelledAt: null,
        punchEvents: {
          some: {
            action: PunchAction.CLOCK_IN
          }
        }
      },
      include: {
        punchEvents: {
          orderBy: [{ eventUtc: "asc" }, { serverReceivedUtc: "asc" }]
        }
      },
      orderBy: { scheduledStartUtc: "desc" }
    });

    for (const shift of activeShifts) {
      const state = derivePunchState(this.toEventRecords(shift.punchEvents));
      if (state === "clocked_in" || state === "on_break") {
        return shift;
      }
    }

    throw new NotFoundException("No active shift punch session was found for this employee.");
  }

  private toEventRecords(
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

  private buildSessionResponse(
    shift: {
      id: string;
      timezone: string;
      scheduledStartUtc: Date;
      scheduledEndUtc: Date;
      punchEvents: Array<{
        action: PunchAction;
        eventUtc: Date;
        isLate: boolean;
        isEarly: boolean;
        breakMinutes: number | null;
      }>;
    },
    employee: { id: string; fullName: string },
    warnings: string[],
    duplicate = false
  ) {
    const events = this.toEventRecords(shift.punchEvents);
    const punchState = derivePunchState(events);
    const breakCount = countBreakStarts(events);
    const workedMinutes = punchState === "clocked_out" ? calculateWorkedMinutes(events) : null;

    return {
      accepted: true,
      duplicate,
      shiftId: shift.id,
      employeeId: employee.id,
      employeeName: employee.fullName,
      punchState: mapPunchStateToResponse(punchState),
      allowedActions: allowedActions(punchState, breakCount).map((action) => action.toLowerCase()),
      timezone: shift.timezone,
      scheduledStartUtc: shift.scheduledStartUtc.toISOString(),
      scheduledEndUtc: shift.scheduledEndUtc.toISOString(),
      workedMinutes,
      warnings: [...new Set(warnings)],
      eventCount: events.length
    };
  }
}
