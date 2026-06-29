import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CorrectionStatus, ShiftStatus, WeeklyPeriodStatus } from "@prisma/client";

import { GlobalRole } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import {
  buildEffectivePunchEvents,
  mapAppliedCorrections
} from "../corrections/punch-corrections";
import {
  buildShiftReview,
  estimateAmountMinor
} from "../shift-review/shift-review";

import {
  aggregateWeeklyTotals,
  canCloseWeeklyPeriod,
  collectWeeklyBlockers
} from "./weekly-close";
import {
  computeTargetPayDate,
  computeWeekEndLocalDate,
  parseWeekStartLocalDate,
  resolveCompanyCloseTimeZone,
  weekRangeToUtcBounds
} from "./week-period";

const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;
const DEFAULT_CLIENT_RATE_MINOR = 2300;

const shiftInclude = {
  employee: { select: { id: true, fullName: true } },
  location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
  serviceClient: { select: { id: true, name: true } },
  punchEvents: { orderBy: { eventUtc: "asc" as const } },
  punchCorrections: true
};

type CloseWeeklyBody = {
  weekStart: string;
  closeNote?: string;
};

type ReopenWeeklyBody = {
  reason: string;
};

@Injectable()
export class WeeklyCloseService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async getWeeklyCloseSummary(
    principal: AuthenticatedPrincipal,
    companyId: string,
    weekStart?: string
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const weekStartLocalDate = parseWeekStartLocalDate(weekStart);
    const weekEndLocalDate = computeWeekEndLocalDate(weekStartLocalDate);
    const targetPayDate = computeTargetPayDate(weekEndLocalDate);

    const locations = await this.prisma.location.findMany({
      where: { companyId },
      select: { id: true, name: true, timezone: true, archivedAt: true }
    });

    const closeTimeZone = resolveCompanyCloseTimeZone(locations);
    const bounds = weekRangeToUtcBounds(weekStartLocalDate, closeTimeZone);

    const [shifts, pendingCorrections, weeklyPeriod] = await Promise.all([
      this.prisma.shift.findMany({
        where: {
          companyId,
          status: ShiftStatus.SCHEDULED,
          punchEvents: { some: {} },
          scheduledStartUtc: {
            gte: new Date(bounds.from),
            lt: new Date(bounds.to)
          }
        },
        include: shiftInclude,
        orderBy: { scheduledStartUtc: "asc" }
      }),
      this.prisma.correctionRequest.findMany({
        where: {
          companyId,
          status: { in: [CorrectionStatus.PENDING, CorrectionStatus.APPROVED] },
          shift: {
            scheduledStartUtc: {
              gte: new Date(bounds.from),
              lt: new Date(bounds.to)
            }
          }
        },
        include: {
          employee: { select: { fullName: true } },
          location: { select: { name: true } },
          shift: { select: { id: true } }
        }
      }),
      this.prisma.weeklyPeriod.findUnique({
        where: {
          companyId_weekStartLocalDate: {
            companyId,
            weekStartLocalDate
          }
        },
        include: {
          closedBy: { select: { id: true, fullName: true, email: true } },
          reopenedBy: { select: { id: true, fullName: true, email: true } },
          snapshots: {
            orderBy: { version: "desc" },
            include: {
              createdBy: { select: { id: true, fullName: true, email: true } }
            }
          }
        }
      })
    ]);

    const shiftSummaries = await Promise.all(
      shifts.map(async (shift) => {
        const events = buildEffectivePunchEvents(
          shift.punchEvents,
          mapAppliedCorrections(shift.punchCorrections)
        );
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

        const employeeAmountMinor = estimateAmountMinor(review.payableMinutes, employeeRateMinor);
        const clientAmountMinor = estimateAmountMinor(review.payableMinutes, clientRateMinor);

        return {
          shiftId: shift.id,
          employeeName: shift.employee.fullName,
          locationName: shift.location.name,
          approvedAt: shift.approvedAt,
          displayStatus: review.displayStatus,
          payableMinutes: review.payableMinutes,
          employeeAmountMinor,
          clientAmountMinor,
          review
        };
      })
    );

    const blockers = collectWeeklyBlockers({
      shifts: shiftSummaries.map((shift) => ({
        shiftId: shift.shiftId,
        employeeName: shift.employeeName,
        locationName: shift.locationName,
        approvedAt: shift.approvedAt,
        review: shift.review
      })),
      pendingCorrections: pendingCorrections.map((correction) => ({
        id: correction.id,
        shiftId: correction.shiftId,
        employeeName: correction.employee.fullName,
        locationName: correction.location.name,
        status: correction.status
      }))
    });

    const totals = aggregateWeeklyTotals(shiftSummaries);
    const locationsIncluded = [
      ...new Map(
        shifts.map((shift) => [shift.location.id, { id: shift.location.id, name: shift.location.name }])
      ).values()
    ];

    const status = weeklyPeriod?.status ?? WeeklyPeriodStatus.OPEN;
    const latestSnapshot = weeklyPeriod?.snapshots[0] ?? null;

    return {
      company: { id: company.id, name: company.name },
      weekStartLocalDate,
      weekEndLocalDate,
      targetPayDate,
      closeTimeZone,
      locationsIncluded,
      status,
      overtimeEnabled: false,
      totals: {
        approvedShiftCount: totals.approvedShiftCount,
        incompleteShiftCount: shiftSummaries.filter((shift) => shift.displayStatus === "incomplete").length,
        unresolvedCorrectionCount: pendingCorrections.length,
        pendingAdditionalTimeCount: shiftSummaries.filter(
          (shift) =>
            !shift.approvedAt &&
            shift.review.warnings.some((warning) => warning.code === "additional_time_pending")
        ).length,
        payableMinutes: totals.payableMinutes,
        employeeGrossEstimateMinor: totals.employeeGrossEstimateMinor,
        clientLaborEstimateMinor: totals.clientLaborEstimateMinor,
        grossMarginEstimateMinor: totals.grossMarginEstimateMinor,
        currencyCode: company.currencyCode
      },
      blockers,
      canClose: canCloseWeeklyPeriod(blockers) && status !== WeeklyPeriodStatus.CLOSED,
      canReopen:
        status === WeeklyPeriodStatus.CLOSED &&
        this.canPrincipalReopen(principal, company.groupId),
      weeklyPeriodId: weeklyPeriod?.id ?? null,
      closedAt: weeklyPeriod?.closedAt?.toISOString() ?? null,
      closedBy: weeklyPeriod?.closedBy
        ? {
            id: weeklyPeriod.closedBy.id,
            label: weeklyPeriod.closedBy.fullName ?? weeklyPeriod.closedBy.email
          }
        : null,
      reopenedAt: weeklyPeriod?.reopenedAt?.toISOString() ?? null,
      reopenedBy: weeklyPeriod?.reopenedBy
        ? {
            id: weeklyPeriod.reopenedBy.id,
            label: weeklyPeriod.reopenedBy.fullName ?? weeklyPeriod.reopenedBy.email
          }
        : null,
      reopenReason: weeklyPeriod?.reopenReason ?? null,
      latestSnapshot: latestSnapshot
        ? {
            id: latestSnapshot.id,
            version: latestSnapshot.version,
            approvedShiftCount: latestSnapshot.approvedShiftCount,
            payableMinutes: latestSnapshot.payableMinutes,
            employeeGrossEstimateMinor: latestSnapshot.employeeGrossEstimateMinor,
            clientLaborEstimateMinor: latestSnapshot.clientLaborEstimateMinor,
            grossMarginEstimateMinor: latestSnapshot.grossMarginEstimateMinor,
            createdAt: latestSnapshot.createdAt.toISOString(),
            createdBy: {
              id: latestSnapshot.createdBy.id,
              label: latestSnapshot.createdBy.fullName ?? latestSnapshot.createdBy.email
            }
          }
        : null,
      snapshotHistory: (weeklyPeriod?.snapshots ?? []).map((snapshot) => ({
        id: snapshot.id,
        version: snapshot.version,
        approvedShiftCount: snapshot.approvedShiftCount,
        payableMinutes: snapshot.payableMinutes,
        employeeGrossEstimateMinor: snapshot.employeeGrossEstimateMinor,
        clientLaborEstimateMinor: snapshot.clientLaborEstimateMinor,
        grossMarginEstimateMinor: snapshot.grossMarginEstimateMinor,
        createdAt: snapshot.createdAt.toISOString(),
        createdBy: {
          id: snapshot.createdBy.id,
          label: snapshot.createdBy.fullName ?? snapshot.createdBy.email
        }
      }))
    };
  }

  async closeWeeklyPeriod(
    principal: AuthenticatedPrincipal,
    companyId: string,
    body: CloseWeeklyBody
  ) {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const summary = await this.getWeeklyCloseSummary(principal, companyId, body.weekStart);

    if (!summary.canClose) {
      throw new BadRequestException("Weekly close is blocked until all issues are resolved.");
    }

    if (summary.status === WeeklyPeriodStatus.CLOSED) {
      throw new BadRequestException("This workweek is already closed.");
    }

    const shiftRows = await this.loadApprovedShiftSnapshotRows(companyId, summary.weekStartLocalDate, summary.closeTimeZone);
    const totals = aggregateWeeklyTotals(shiftRows);
    const closedAt = new Date();
    const nextVersion =
      summary.snapshotHistory.length > 0
        ? Math.max(...summary.snapshotHistory.map((snapshot) => snapshot.version)) + 1
        : 1;

    const snapshotPayload = {
      weekStartLocalDate: summary.weekStartLocalDate,
      weekEndLocalDate: summary.weekEndLocalDate,
      targetPayDate: summary.targetPayDate,
      closeTimeZone: summary.closeTimeZone,
      closeNote: body.closeNote ?? null,
      overtimeEnabled: false,
      locationsIncluded: summary.locationsIncluded,
      shifts: shiftRows.map((row) => ({
        shiftId: row.shiftId,
        employeeId: row.employeeId,
        serviceClientId: row.serviceClientId,
        locationId: row.locationId,
        payableMinutes: row.payableMinutes,
        employeeRateMinor: row.employeeRateMinor,
        clientRateMinor: row.clientRateMinor,
        employeeAmountMinor: row.employeeAmountMinor,
        clientAmountMinor: row.clientAmountMinor,
        grossMarginMinor: (row.clientAmountMinor ?? 0) - (row.employeeAmountMinor ?? 0)
      }))
    };

    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { groupId: true }
    });

    await this.prisma.$transaction(async (tx) => {
      const period = summary.weeklyPeriodId
        ? await tx.weeklyPeriod.update({
            where: { id: summary.weeklyPeriodId },
            data: {
              status: WeeklyPeriodStatus.CLOSED,
              closedAt,
              closedByUserId: principal.userId,
              weekEndLocalDate: summary.weekEndLocalDate,
              closeTimeZone: summary.closeTimeZone,
              targetPayDate: summary.targetPayDate
            }
          })
        : await tx.weeklyPeriod.create({
            data: {
              groupId: company.groupId,
              companyId,
              weekStartLocalDate: summary.weekStartLocalDate,
              weekEndLocalDate: summary.weekEndLocalDate,
              closeTimeZone: summary.closeTimeZone,
              targetPayDate: summary.targetPayDate,
              status: WeeklyPeriodStatus.CLOSED,
              closedAt,
              closedByUserId: principal.userId
            }
          });

      await tx.weeklyCloseSnapshot.create({
        data: {
          weeklyPeriodId: period.id,
          version: nextVersion,
          snapshotPayload,
          approvedShiftCount: totals.approvedShiftCount,
          payableMinutes: totals.payableMinutes,
          employeeGrossEstimateMinor: totals.employeeGrossEstimateMinor,
          clientLaborEstimateMinor: totals.clientLaborEstimateMinor,
          grossMarginEstimateMinor: totals.grossMarginEstimateMinor,
          createdByUserId: principal.userId
        }
      });

      await tx.auditEvent.create({
        data: {
          groupId: company.groupId,
          companyId,
          actorUserId: principal.userId,
          action: "WEEKLY_PERIOD_CLOSED",
          targetType: "WeeklyPeriod",
          targetId: period.id,
          metadata: {
            weekStartLocalDate: summary.weekStartLocalDate,
            version: nextVersion,
            closeNote: body.closeNote ?? null
          }
        }
      });
    });

    return this.getWeeklyCloseSummary(principal, companyId, summary.weekStartLocalDate);
  }

  async reopenWeeklyPeriod(
    principal: AuthenticatedPrincipal,
    weeklyPeriodId: string,
    body: ReopenWeeklyBody
  ) {
    const reason = body.reason?.trim();
    if (!reason) {
      throw new BadRequestException("Reopen reason is required.");
    }

    const period = await this.prisma.weeklyPeriod.findUnique({
      where: { id: weeklyPeriodId },
      include: { company: { select: { id: true, groupId: true } } }
    });

    if (!period) {
      throw new NotFoundException("Weekly period not found.");
    }

    await this.companyScopeService.requireGroupOwner(principal, period.companyId);

    if (period.status !== WeeklyPeriodStatus.CLOSED) {
      throw new BadRequestException("Only a closed workweek can be reopened.");
    }

    const reopenedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.weeklyPeriod.update({
        where: { id: period.id },
        data: {
          status: WeeklyPeriodStatus.REOPENED,
          reopenedAt,
          reopenedByUserId: principal.userId,
          reopenReason: reason
        }
      });

      await tx.auditEvent.create({
        data: {
          groupId: period.groupId,
          companyId: period.companyId,
          actorUserId: principal.userId,
          action: "WEEKLY_PERIOD_REOPENED",
          targetType: "WeeklyPeriod",
          targetId: period.id,
          metadata: {
            weekStartLocalDate: period.weekStartLocalDate,
            reason
          }
        }
      });
    });

    return this.getWeeklyCloseSummary(principal, period.companyId, period.weekStartLocalDate);
  }

  private async loadApprovedShiftSnapshotRows(
    companyId: string,
    weekStartLocalDate: string,
    closeTimeZone: string
  ) {
    const bounds = weekRangeToUtcBounds(weekStartLocalDate, closeTimeZone);
    const shifts = await this.prisma.shift.findMany({
      where: {
        companyId,
        status: ShiftStatus.SCHEDULED,
        approvedAt: { not: null },
        punchEvents: { some: {} },
        scheduledStartUtc: {
          gte: new Date(bounds.from),
          lt: new Date(bounds.to)
        }
      },
      include: shiftInclude
    });

    return Promise.all(
      shifts.map(async (shift) => {
        const events = buildEffectivePunchEvents(
          shift.punchEvents,
          mapAppliedCorrections(shift.punchCorrections)
        );
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
        const employeeAmountMinor = estimateAmountMinor(review.payableMinutes, employeeRateMinor);
        const clientAmountMinor = estimateAmountMinor(review.payableMinutes, clientRateMinor);

        return {
          shiftId: shift.id,
          employeeId: shift.employeeId,
          serviceClientId: shift.serviceClientId,
          locationId: shift.locationId,
          approvedAt: shift.approvedAt,
          payableMinutes: review.payableMinutes,
          employeeRateMinor,
          clientRateMinor,
          employeeAmountMinor,
          clientAmountMinor
        };
      })
    );
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

  private canPrincipalReopen(principal: AuthenticatedPrincipal, groupId: string) {
    if (principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN) {
      return true;
    }

    return principal.groupOwnerGroupIds.includes(groupId);
  }
}
