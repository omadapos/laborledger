import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ShiftStatus } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { WeeklyPeriodLockService } from "../weekly-close/weekly-period-lock.service";

import {
  buildShiftReview,
  estimateAmountMinor,
  matchesReviewStatusFilter,
  type ReviewStatusFilter
} from "./shift-review";
import {
  buildEffectivePunchEvents,
  buildPunchTimeline,
  mapAppliedCorrections
} from "../corrections/punch-corrections";

const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;
const DEFAULT_CLIENT_RATE_MINOR = 2300;

type ListReviewShiftsOptions = {
  from?: string;
  to?: string;
  locationId?: string;
  employeeId?: string;
  status?: ReviewStatusFilter;
};

const shiftInclude = {
  employee: { select: { id: true, fullName: true } },
  location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
  serviceClient: { select: { id: true, name: true } },
  punchEvents: { orderBy: { eventUtc: "asc" as const } },
  punchCorrections: true
};

@Injectable()
export class ShiftReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService,
    @Inject(WeeklyPeriodLockService) private readonly weeklyPeriodLockService: WeeklyPeriodLockService
  ) {}

  async listReviewShifts(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListReviewShiftsOptions
  ) {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    await this.companyScopeService.assertLocationFilterAllowed(principal, companyId, options.locationId);
    await this.validateListFilters(companyId, options);

    const from = options.from ? this.parseInstant(options.from, "from") : null;
    const to = options.to ? this.parseInstant(options.to, "to") : null;

    if (from && to && to <= from) {
      throw new BadRequestException("to must be after from.");
    }

    const locationScope = this.companyScopeService.buildLocationIdFilter(access, options.locationId);

    const shifts = await this.prisma.shift.findMany({
      where: {
        companyId,
        status: ShiftStatus.SCHEDULED,
        punchEvents: { some: {} },
        ...locationScope,
        ...(options.employeeId ? { employeeId: options.employeeId } : {}),
        ...(from ? { scheduledStartUtc: { gte: from } } : {}),
        ...(to ? { scheduledStartUtc: { lt: to } } : {})
      },
      include: shiftInclude,
      orderBy: { scheduledStartUtc: "desc" }
    });

    const summaries = await Promise.all(
      shifts.map(async (shift) => this.toReviewSummary(shift, false))
    );

    return summaries.filter((summary) => matchesReviewStatusFilter(summary, options.status));
  }

  async getReviewShift(principal: AuthenticatedPrincipal, shiftId: string) {
    const shift = await this.loadShift(shiftId);
    await this.companyScopeService.requireShiftLocationAccess(principal, shift);
    return this.toReviewSummary(shift, true);
  }

  async approveShift(principal: AuthenticatedPrincipal, shiftId: string) {
    const shift = await this.loadShift(shiftId);
    await this.companyScopeService.requireShiftLocationAccess(principal, shift);
    await this.weeklyPeriodLockService.assertWeekOpenForShift({
      companyId: shift.companyId,
      scheduledStartUtc: shift.scheduledStartUtc,
      timezone: shift.timezone
    });

    const review = buildShiftReview({
      approvedAt: shift.approvedAt,
      additionalTimeApprovedAt: shift.additionalTimeApprovedAt,
      scheduledEndUtc: shift.scheduledEndUtc,
      events: this.resolveEffectiveEvents(shift)
    });

    if (!review.canApproveShift) {
      throw new BadRequestException(
        review.approvalBlockReasons[0] ?? "Shift cannot be approved."
      );
    }

    const approvedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.shift.update({
        where: { id: shift.id },
        data: {
          approvedAt,
          approvedByUserId: principal.userId
        }
      });

      await tx.auditEvent.create({
        data: {
          groupId: shift.groupId,
          companyId: shift.companyId,
          actorUserId: principal.userId,
          action: "SHIFT_APPROVED",
          targetType: "Shift",
          targetId: shift.id,
          metadata: {
            payableMinutes: review.payableMinutes,
            workedMinutes: review.workedMinutes,
            additionalMinutes: review.additionalMinutes
          }
        }
      });
    });

    return this.getReviewShift(principal, shiftId);
  }

  async approveAdditionalTime(principal: AuthenticatedPrincipal, shiftId: string) {
    const shift = await this.loadShift(shiftId);
    await this.companyScopeService.requireShiftLocationAccess(principal, shift);
    await this.weeklyPeriodLockService.assertWeekOpenForShift({
      companyId: shift.companyId,
      scheduledStartUtc: shift.scheduledStartUtc,
      timezone: shift.timezone
    });

    const review = buildShiftReview({
      approvedAt: shift.approvedAt,
      additionalTimeApprovedAt: shift.additionalTimeApprovedAt,
      scheduledEndUtc: shift.scheduledEndUtc,
      events: this.resolveEffectiveEvents(shift)
    });

    if (!review.canApproveAdditionalTime) {
      throw new BadRequestException("Additional time cannot be approved for this shift.");
    }

    const additionalTimeApprovedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.shift.update({
        where: { id: shift.id },
        data: {
          additionalTimeApprovedAt,
          additionalTimeApprovedByUserId: principal.userId
        }
      });

      await tx.auditEvent.create({
        data: {
          groupId: shift.groupId,
          companyId: shift.companyId,
          actorUserId: principal.userId,
          action: "SHIFT_ADDITIONAL_TIME_APPROVED",
          targetType: "Shift",
          targetId: shift.id,
          metadata: {
            additionalMinutes: review.additionalMinutes
          }
        }
      });
    });

    return this.getReviewShift(principal, shiftId);
  }

  private async loadShift(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: shiftInclude
    });

    if (!shift) {
      throw new NotFoundException("Shift not found.");
    }

    return shift;
  }

  private async validateListFilters(companyId: string, options: ListReviewShiftsOptions) {
    if (options.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: options.locationId, companyId },
        select: { id: true }
      });
      if (!location) {
        throw new BadRequestException("Location must belong to the selected company.");
      }
    }

    if (options.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: options.employeeId, companyId },
        select: { id: true }
      });
      if (!employee) {
        throw new BadRequestException("Employee must belong to the selected company.");
      }
    }

    if (
      options.status &&
      !["needs_review", "approved", "incomplete", "exceptions"].includes(options.status)
    ) {
      throw new BadRequestException("status must be a supported review filter.");
    }
  }

  private resolveEffectiveEvents(shift: Awaited<ReturnType<typeof this.loadShift>>) {
    return buildEffectivePunchEvents(
      shift.punchEvents,
      mapAppliedCorrections(shift.punchCorrections)
    );
  }

  private async toReviewSummary(
    shift: Awaited<ReturnType<typeof this.loadShift>>,
    includeTimeline: boolean
  ) {
    const events = this.resolveEffectiveEvents(shift);
    const review = buildShiftReview({
      approvedAt: shift.approvedAt,
      additionalTimeApprovedAt: shift.additionalTimeApprovedAt,
      scheduledEndUtc: shift.scheduledEndUtc,
      events
    });

    const rateAt = review.clockOutUtc ?? shift.scheduledEndUtc;
    const [employeeRateMinor, clientRateMinor] = await Promise.all([
      this.resolveEmployeeRateMinor(shift.employeeId, rateAt),
      this.resolveClientRateMinor(shift.serviceClientId, rateAt)
    ]);

    return {
      shiftId: shift.id,
      companyId: shift.companyId,
      employee: shift.employee,
      serviceClient: shift.serviceClient,
      location: shift.location,
      scheduledStartUtc: shift.scheduledStartUtc.toISOString(),
      scheduledEndUtc: shift.scheduledEndUtc.toISOString(),
      clockInUtc: review.clockInUtc?.toISOString() ?? null,
      clockOutUtc: review.clockOutUtc?.toISOString() ?? null,
      breakDurationMinutes: review.breakDurationMinutes,
      workedMinutes: review.workedMinutes,
      additionalMinutes: review.additionalMinutes,
      payableMinutes: review.payableMinutes,
      estimatedEmployeeAmountMinor: estimateAmountMinor(review.payableMinutes, employeeRateMinor),
      estimatedClientAmountMinor: estimateAmountMinor(review.payableMinutes, clientRateMinor),
      currencyCode: "USD",
      punchState: review.punchState,
      displayStatus: review.displayStatus,
      approvedAt: shift.approvedAt?.toISOString() ?? null,
      additionalTimeApprovedAt: shift.additionalTimeApprovedAt?.toISOString() ?? null,
      warnings: review.warnings,
      canApproveShift: review.canApproveShift,
      canApproveAdditionalTime: review.canApproveAdditionalTime,
      approvalBlockReasons: review.approvalBlockReasons,
      ...(includeTimeline
        ? {
            punchTimeline: buildPunchTimeline(
              shift.punchEvents,
              mapAppliedCorrections(shift.punchCorrections)
            ),
            originalPunchTimeline: shift.punchEvents.map((event) => ({
              id: event.id,
              action: event.action,
              eventUtc: event.eventUtc.toISOString(),
              isLate: event.isLate,
              isEarly: event.isEarly,
              breakMinutes: event.breakMinutes
            }))
          }
        : {})
    };
  }

  private async resolveEmployeeRateMinor(employeeId: string, at: Date) {
    const rates = await this.prisma.employeeRate.findMany({
      where: { employeeId },
      orderBy: { effectiveStart: "desc" }
    });

    return this.pickEffectiveRate(rates, at)?.rateMinorUnits ?? DEFAULT_EMPLOYEE_RATE_MINOR;
  }

  private async resolveClientRateMinor(serviceClientId: string, at: Date) {
    const rates = await this.prisma.clientLaborRate.findMany({
      where: { serviceClientId },
      orderBy: { effectiveStart: "desc" }
    });

    return this.pickEffectiveRate(rates, at)?.rateMinorUnits ?? DEFAULT_CLIENT_RATE_MINOR;
  }

  private pickEffectiveRate(
    rates: Array<{ rateMinorUnits: number; effectiveStart: Date; effectiveEnd: Date | null }>,
    at: Date
  ) {
    const active = rates.filter((rate) => {
      const end = rate.effectiveEnd;
      return rate.effectiveStart <= at && (!end || end > at);
    });

    if (active.length === 0) {
      return null;
    }

    return active.reduce((latest, rate) =>
      rate.effectiveStart > latest.effectiveStart ? rate : latest
    );
  }

  private parseInstant(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date-time.`);
    }

    return parsed;
  }
}
