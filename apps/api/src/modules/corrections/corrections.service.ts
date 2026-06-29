import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CorrectionStatus,
  CorrectionType,
  PunchAction,
  Prisma,
  ShiftStatus
} from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { WeeklyPeriodLockService } from "../weekly-close/weekly-period-lock.service";
import { derivePunchState } from "../kiosk/punch-state";

import {
  buildEffectivePunchEvents,
  buildProposedEvents,
  buildPunchTimeline,
  computeWorkedMinuteImpact,
  correctionTypeLabel,
  correctionTypeToAction,
  mapAppliedCorrections,
  serializePayload,
  type StoredCorrectionPayload
} from "./punch-corrections";

type ListCorrectionsOptions = {
  from?: string;
  to?: string;
  locationId?: string;
  employeeId?: string;
  status?: CorrectionStatus;
  type?: CorrectionType;
};

type CreateCorrectionInput = {
  type: CorrectionType;
  reason: string;
  proposedEventUtc: string;
  punchEventId?: string;
  proposedBreakMinutes?: number;
};

const correctionInclude = {
  employee: { select: { id: true, fullName: true } },
  location: { select: { id: true, name: true, timezone: true } },
  shift: {
    select: {
      id: true,
      scheduledStartUtc: true,
      scheduledEndUtc: true,
      approvedAt: true,
      additionalTimeApprovedAt: true,
      timezone: true
    }
  },
  requestedBy: { select: { id: true, fullName: true, email: true } },
  reviewedBy: { select: { id: true, fullName: true, email: true } },
  appliedBy: { select: { id: true, fullName: true, email: true } },
  punchCorrection: true
} satisfies Prisma.CorrectionRequestInclude;

@Injectable()
export class CorrectionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService,
    @Inject(WeeklyPeriodLockService) private readonly weeklyPeriodLockService: WeeklyPeriodLockService
  ) {}

  async listCorrections(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListCorrectionsOptions
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

    const records = await this.prisma.correctionRequest.findMany({
      where: {
        companyId,
        ...locationScope,
        ...(options.status ? { status: options.status } : {}),
        ...(options.type ? { type: options.type } : {}),
        ...(options.employeeId ? { employeeId: options.employeeId } : {}),
        ...(from || to
          ? {
              shift: {
                ...(from ? { scheduledStartUtc: { gte: from } } : {}),
                ...(to ? { scheduledStartUtc: { lt: to } } : {})
              }
            }
          : {})
      },
      include: correctionInclude,
      orderBy: { createdAt: "desc" }
    });

    return records.map((record) => this.toSummary(record));
  }

  async getCorrection(principal: AuthenticatedPrincipal, correctionId: string) {
    const record = await this.loadCorrection(correctionId);
    await this.companyScopeService.requireShiftLocationAccess(principal, {
      companyId: record.companyId,
      locationId: record.locationId
    });
    return this.toDetail(record);
  }

  async createCorrection(
    principal: AuthenticatedPrincipal,
    shiftId: string,
    input: CreateCorrectionInput
  ) {
    const shift = await this.loadShift(shiftId);
    await this.companyScopeService.requireManagementCompany(principal, shift.companyId);
    await this.weeklyPeriodLockService.assertWeekOpenForShift({
      companyId: shift.companyId,
      scheduledStartUtc: shift.scheduledStartUtc,
      timezone: shift.timezone
    });

    if (shift.approvedAt) {
      throw new BadRequestException("Corrections cannot be created for an already approved shift.");
    }

    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException("Correction reason is required.");
    }

    const proposedEventUtc = this.parseInstant(input.proposedEventUtc, "proposedEventUtc");
    const appliedCorrections = mapAppliedCorrections(shift.punchCorrections);
    const currentState = derivePunchState(
      buildEffectivePunchEvents(shift.punchEvents, appliedCorrections)
    );

    this.validateCorrectionType(input.type, currentState, shift.punchEvents, input.punchEventId);

    const pendingDuplicate = await this.prisma.correctionRequest.findFirst({
      where: {
        shiftId: shift.id,
        type: input.type,
        status: { in: [CorrectionStatus.PENDING, CorrectionStatus.APPROVED] }
      }
    });

    if (pendingDuplicate) {
      throw new BadRequestException("A pending or approved correction of this type already exists for the shift.");
    }

    const originalPayload = this.buildOriginalPayload(
      input.type,
      shift.punchEvents,
      input.punchEventId
    );

    let proposedEvents;
    try {
      proposedEvents = buildProposedEvents(
        shift.punchEvents,
        appliedCorrections,
        input.type,
        {
          eventUtc: proposedEventUtc,
          punchEventId: input.punchEventId,
          breakMinutes: input.proposedBreakMinutes ?? null
        },
        {
          scheduledStartUtc: shift.scheduledStartUtc,
          scheduledEndUtc: shift.scheduledEndUtc
        }
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Proposed correction is invalid."
      );
    }

    const proposedPayload: StoredCorrectionPayload = {
      action: correctionTypeToAction(input.type),
      eventUtc: proposedEventUtc.toISOString(),
      punchEventId: input.punchEventId,
      breakMinutes:
        input.proposedBreakMinutes ??
        proposedEvents.find((event) => event.action === correctionTypeToAction(input.type))
          ?.breakMinutes ??
        null
    };

    const impact = computeWorkedMinuteImpact({
      scheduledEndUtc: shift.scheduledEndUtc,
      approvedAt: shift.approvedAt,
      additionalTimeApprovedAt: shift.additionalTimeApprovedAt,
      punchEvents: shift.punchEvents,
      punchCorrections: appliedCorrections,
      proposedEvents
    });

    const created = await this.prisma.correctionRequest.create({
      data: {
        groupId: shift.groupId,
        companyId: shift.companyId,
        shiftId: shift.id,
        employeeId: shift.employeeId,
        locationId: shift.locationId,
        type: input.type,
        status: CorrectionStatus.PENDING,
        reason,
        originalPayload: serializePayload(originalPayload),
        proposedPayload: serializePayload(proposedPayload),
        requestedByUserId: principal.userId
      },
      include: correctionInclude
    });

    await this.prisma.auditEvent.create({
      data: {
        groupId: shift.groupId,
        companyId: shift.companyId,
        actorUserId: principal.userId,
        action: "CORRECTION_REQUESTED",
        targetType: "CorrectionRequest",
        targetId: created.id,
        reason,
        metadata: {
          shiftId: shift.id,
          type: input.type,
          proposedPayload
        }
      }
    });

    return this.toDetail(created, shift.punchEvents, appliedCorrections, impact);
  }

  async approveCorrection(
    principal: AuthenticatedPrincipal,
    correctionId: string,
    reviewReason?: string
  ) {
    const record = await this.loadCorrection(correctionId);
    await this.companyScopeService.requireShiftLocationAccess(principal, {
      companyId: record.companyId,
      locationId: record.locationId
    });
    await this.assertCorrectionWeekOpen(record);

    if (record.status !== CorrectionStatus.PENDING) {
      throw new BadRequestException("Only pending corrections can be approved.");
    }

    if (record.shift.approvedAt) {
      throw new BadRequestException("Corrections cannot be approved for an already approved shift.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.correctionRequest.update({
        where: { id: record.id },
        data: {
          status: CorrectionStatus.APPROVED,
          reviewedByUserId: principal.userId,
          reviewedAt: new Date(),
          reviewReason: reviewReason?.trim() || null
        },
        include: correctionInclude
      });

      await tx.auditEvent.create({
        data: {
          groupId: record.groupId,
          companyId: record.companyId,
          actorUserId: principal.userId,
          action: "CORRECTION_APPROVED",
          targetType: "CorrectionRequest",
          targetId: record.id,
          reason: reviewReason?.trim() || null
        }
      });

      return next;
    });

    return this.toDetail(updated);
  }

  async rejectCorrection(
    principal: AuthenticatedPrincipal,
    correctionId: string,
    reviewReason: string
  ) {
    const record = await this.loadCorrection(correctionId);
    await this.companyScopeService.requireShiftLocationAccess(principal, {
      companyId: record.companyId,
      locationId: record.locationId
    });
    await this.assertCorrectionWeekOpen(record);

    if (record.status !== CorrectionStatus.PENDING) {
      throw new BadRequestException("Only pending corrections can be rejected.");
    }

    const reason = reviewReason.trim();
    if (!reason) {
      throw new BadRequestException("Review reason is required when rejecting a correction.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.correctionRequest.update({
        where: { id: record.id },
        data: {
          status: CorrectionStatus.REJECTED,
          reviewedByUserId: principal.userId,
          reviewedAt: new Date(),
          reviewReason: reason
        },
        include: correctionInclude
      });

      await tx.auditEvent.create({
        data: {
          groupId: record.groupId,
          companyId: record.companyId,
          actorUserId: principal.userId,
          action: "CORRECTION_REJECTED",
          targetType: "CorrectionRequest",
          targetId: record.id,
          reason
        }
      });

      return next;
    });

    return this.toDetail(updated);
  }

  async applyCorrection(principal: AuthenticatedPrincipal, correctionId: string) {
    const record = await this.loadCorrection(correctionId);
    await this.companyScopeService.requireShiftLocationAccess(principal, {
      companyId: record.companyId,
      locationId: record.locationId
    });
    await this.assertCorrectionWeekOpen(record);

    if (record.status === CorrectionStatus.APPLIED) {
      throw new BadRequestException("Correction has already been applied.");
    }

    if (record.status === CorrectionStatus.REJECTED) {
      throw new BadRequestException("Rejected corrections cannot be applied.");
    }

    if (record.status !== CorrectionStatus.APPROVED) {
      throw new BadRequestException("Correction must be approved before it can be applied.");
    }

    if (record.shift.approvedAt) {
      throw new BadRequestException("Corrections cannot be applied to an already approved shift.");
    }

    if (record.punchCorrection) {
      throw new BadRequestException("Correction has already been applied.");
    }

    const shift = await this.loadShift(record.shiftId);
    const proposedPayload = record.proposedPayload as StoredCorrectionPayload;
    const proposedEventUtc = this.parseInstant(proposedPayload.eventUtc ?? "", "proposedEventUtc");
    const appliedCorrections = mapAppliedCorrections(shift.punchCorrections);
    const action = correctionTypeToAction(record.type);

    let proposedEvents;
    try {
      proposedEvents = buildProposedEvents(
        shift.punchEvents,
        appliedCorrections,
        record.type,
        {
          eventUtc: proposedEventUtc,
          punchEventId: proposedPayload.punchEventId,
          breakMinutes: proposedPayload.breakMinutes ?? null
        },
        {
          scheduledStartUtc: shift.scheduledStartUtc,
          scheduledEndUtc: shift.scheduledEndUtc
        }
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Approved correction cannot be applied."
      );
    }

    const finalEvent = proposedEvents.find((event) => event.action === action);
    if (!finalEvent) {
      throw new BadRequestException("Approved correction payload is invalid.");
    }

    const appliedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.punchCorrection.create({
        data: {
          groupId: record.groupId,
          companyId: record.companyId,
          shiftId: record.shiftId,
          correctionRequestId: record.id,
          targetPunchEventId: proposedPayload.punchEventId ?? null,
          action,
          eventUtc: proposedEventUtc,
          breakMinutes: finalEvent.breakMinutes,
          isLate: finalEvent.isLate,
          isEarly: finalEvent.isEarly,
          appliedByUserId: principal.userId
        }
      });

      const next = await tx.correctionRequest.update({
        where: { id: record.id },
        data: {
          status: CorrectionStatus.APPLIED,
          appliedAt,
          appliedByUserId: principal.userId,
          finalPayload: serializePayload({
            action,
            eventUtc: proposedEventUtc.toISOString(),
            punchEventId: proposedPayload.punchEventId,
            breakMinutes: finalEvent.breakMinutes ?? null
          })
        },
        include: correctionInclude
      });

      await tx.auditEvent.create({
        data: {
          groupId: record.groupId,
          companyId: record.companyId,
          actorUserId: principal.userId,
          action: "CORRECTION_APPLIED",
          targetType: "CorrectionRequest",
          targetId: record.id,
          metadata: {
            shiftId: record.shiftId,
            type: record.type,
            finalPayload: next.finalPayload
          }
        }
      });

      return next;
    });

    return this.toDetail(updated);
  }

  private validateCorrectionType(
    type: CorrectionType,
    currentState: ReturnType<typeof derivePunchState>,
    punchEvents: Array<{ id: string; action: PunchAction }>,
    punchEventId?: string
  ) {
    switch (type) {
      case CorrectionType.MISSING_CLOCK_OUT:
        if (currentState === "clocked_out") {
          throw new BadRequestException("Shift already has a clock-out.");
        }
        if (currentState === "scheduled") {
          throw new BadRequestException("Shift has no clock-in to correct.");
        }
        break;
      case CorrectionType.OPEN_BREAK_END:
        if (currentState !== "on_break") {
          throw new BadRequestException("Shift does not have an open break.");
        }
        break;
      case CorrectionType.INCORRECT_CLOCK_IN:
      case CorrectionType.INCORRECT_CLOCK_OUT:
      case CorrectionType.INCORRECT_BREAK_START:
      case CorrectionType.INCORRECT_BREAK_END: {
        if (!punchEventId) {
          throw new BadRequestException("punchEventId is required for this correction type.");
        }
        const target = punchEvents.find((event) => event.id === punchEventId);
        if (!target) {
          throw new BadRequestException("Punch event must belong to the shift.");
        }
        const expected = correctionTypeToAction(type);
        if (target.action !== expected) {
          throw new BadRequestException("Punch event action does not match correction type.");
        }
        break;
      }
      default:
        break;
    }
  }

  private buildOriginalPayload(
    type: CorrectionType,
    punchEvents: Array<{
      id: string;
      action: PunchAction;
      eventUtc: Date;
      breakMinutes: number | null;
    }>,
    punchEventId?: string
  ): StoredCorrectionPayload {
    if (
      type === CorrectionType.MISSING_CLOCK_OUT ||
      type === CorrectionType.OPEN_BREAK_END
    ) {
      return { action: correctionTypeToAction(type) };
    }

    const target = punchEvents.find((event) => event.id === punchEventId);
    if (!target) {
      throw new BadRequestException("Original punch event was not found.");
    }

    return {
      punchEventId: target.id,
      action: target.action,
      eventUtc: target.eventUtc.toISOString(),
      breakMinutes: target.breakMinutes
    };
  }

  private async assertCorrectionWeekOpen(record: {
    companyId: string;
    shift: { scheduledStartUtc: Date; timezone: string };
  }) {
    await this.weeklyPeriodLockService.assertWeekOpenForShift({
      companyId: record.companyId,
      scheduledStartUtc: record.shift.scheduledStartUtc,
      timezone: record.shift.timezone
    });
  }

  private async loadShift(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        punchEvents: { orderBy: { eventUtc: "asc" } },
        punchCorrections: true
      }
    });

    if (!shift || shift.status !== ShiftStatus.SCHEDULED) {
      throw new NotFoundException("Shift not found.");
    }

    return shift;
  }

  private async loadCorrection(correctionId: string) {
    const record = await this.prisma.correctionRequest.findUnique({
      where: { id: correctionId },
      include: correctionInclude
    });

    if (!record) {
      throw new NotFoundException("Correction request not found.");
    }

    return record;
  }

  private async validateListFilters(companyId: string, options: ListCorrectionsOptions) {
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
  }

  private async toDetail(
    record: Prisma.CorrectionRequestGetPayload<{ include: typeof correctionInclude }>,
    punchEvents = null as Awaited<ReturnType<typeof this.loadShift>>["punchEvents"] | null,
    appliedCorrections = null as ReturnType<typeof mapAppliedCorrections> | null,
    impactOverride: ReturnType<typeof computeWorkedMinuteImpact> | null = null
  ) {
    const shiftEvents =
      punchEvents ??
      (
        await this.prisma.shift.findUnique({
          where: { id: record.shiftId },
          include: { punchEvents: { orderBy: { eventUtc: "asc" } }, punchCorrections: true }
        })
      )?.punchEvents ??
      [];

    const shiftCorrections =
      appliedCorrections ??
      mapAppliedCorrections(
        (
          await this.prisma.shift.findUnique({
            where: { id: record.shiftId },
            include: { punchCorrections: true }
          })
        )?.punchCorrections ?? []
      );

    const proposedPayload = record.proposedPayload as StoredCorrectionPayload;
    const proposedEventUtc = proposedPayload.eventUtc
      ? this.parseInstant(proposedPayload.eventUtc, "proposedEventUtc")
      : null;

    let impact = impactOverride;
    if (!impact && proposedEventUtc) {
      const proposedEvents = buildProposedEvents(
        shiftEvents,
        shiftCorrections,
        record.type,
        {
          eventUtc: proposedEventUtc,
          punchEventId: proposedPayload.punchEventId,
          breakMinutes: proposedPayload.breakMinutes ?? null
        },
        {
          scheduledStartUtc: record.shift.scheduledStartUtc,
          scheduledEndUtc: record.shift.scheduledEndUtc
        }
      );

      impact = computeWorkedMinuteImpact({
        scheduledEndUtc: record.shift.scheduledEndUtc,
        approvedAt: record.shift.approvedAt,
        additionalTimeApprovedAt: record.shift.additionalTimeApprovedAt,
        punchEvents: shiftEvents,
        punchCorrections: shiftCorrections,
        proposedEvents
      });
    }

    return {
      ...this.toSummary(record),
      originalPayload: record.originalPayload,
      proposedPayload: record.proposedPayload,
      finalPayload: record.finalPayload,
      reviewReason: record.reviewReason,
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
      appliedAt: record.appliedAt?.toISOString() ?? null,
      requestedBy: record.requestedBy,
      reviewedBy: record.reviewedBy,
      appliedBy: record.appliedBy,
      shift: {
        id: record.shift.id,
        scheduledStartUtc: record.shift.scheduledStartUtc.toISOString(),
        scheduledEndUtc: record.shift.scheduledEndUtc.toISOString(),
        timezone: record.shift.timezone,
        approvedAt: record.shift.approvedAt?.toISOString() ?? null
      },
      originalTimeline: buildPunchTimeline(shiftEvents, shiftCorrections),
      workedMinuteImpact: impact,
      canApprove: record.status === CorrectionStatus.PENDING && !record.shift.approvedAt,
      canReject: record.status === CorrectionStatus.PENDING,
      canApply: record.status === CorrectionStatus.APPROVED && !record.punchCorrection
    };
  }

  private toSummary(record: Prisma.CorrectionRequestGetPayload<{ include: typeof correctionInclude }>) {
    return {
      id: record.id,
      companyId: record.companyId,
      shiftId: record.shiftId,
      employee: record.employee,
      location: record.location,
      type: record.type,
      typeLabel: correctionTypeLabel(record.type),
      status: record.status,
      reason: record.reason,
      requestedAt: record.createdAt.toISOString(),
      requestedByLabel: record.requestedBy?.fullName ?? record.requestedBy?.email ?? "Administrator",
      scheduledStartUtc: record.shift.scheduledStartUtc.toISOString(),
      shiftTimezone: record.shift.timezone
    };
  }

  private parseInstant(value: string, fieldName: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date-time.`);
    }

    return parsed;
  }
}
