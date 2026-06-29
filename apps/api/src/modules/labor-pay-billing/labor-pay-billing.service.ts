import {
  BadRequestException,
  Inject,
  Injectable,
  NotImplementedException
} from "@nestjs/common";
import { ShiftStatus, WeeklyPeriodStatus } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import {
  buildEffectivePunchEvents,
  mapAppliedCorrections
} from "../corrections/punch-corrections";
import { buildShiftReview, estimateAmountMinor } from "../shift-review/shift-review";
import {
  computeWeekEndLocalDate,
  parseWeekStartLocalDate,
  resolveCompanyCloseTimeZone,
  weekRangeToUtcBounds
} from "../weekly-close/week-period";

import {
  aggregateClientLaborBillingRows,
  aggregateEmployeePayRows,
  buildClientBillingCsv,
  buildClientBillingCsvWithWorkContext,
  buildClientBillingWorkContextRow,
  buildEmployeePayCsv,
  dataSourceLabel,
  matchesLaborFilters,
  parseOnlyClosedWeeks,
  summarizeLaborRows,
  type ExcludedShiftWarning,
  type LaborPayBillingFilters,
  type LaborPayBillingPreview,
  type ShiftLaborRow
} from "./labor-pay-billing";

const DEFAULT_EMPLOYEE_RATE_MINOR = 1900;
const DEFAULT_CLIENT_RATE_MINOR = 2300;

type PreviewQuery = {
  weekStart?: string;
  serviceClientId?: string;
  locationId?: string;
  employeeId?: string;
  onlyClosedWeeks?: string | boolean;
};

type SnapshotShiftRow = {
  shiftId: string;
  employeeId: string;
  serviceClientId: string;
  locationId: string;
  payableMinutes: number;
  employeeRateMinor: number;
  clientRateMinor: number;
  employeeAmountMinor: number;
  clientAmountMinor: number;
  grossMarginMinor: number;
};

type SnapshotPayload = {
  shifts?: SnapshotShiftRow[];
};

const shiftInclude = {
  employee: { select: { id: true, fullName: true } },
  location: { select: { id: true, name: true, timezone: true, serviceClientId: true } },
  serviceClient: { select: { id: true, name: true } },
  punchEvents: { orderBy: { eventUtc: "asc" as const } },
  punchCorrections: true
};

@Injectable()
export class LaborPayBillingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async getPreview(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: PreviewQuery
  ): Promise<LaborPayBillingPreview & { company: { id: string; name: string } }> {
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    await this.validateFilters(principal, companyId, query);

    const weekStart = parseWeekStartLocalDate(query.weekStart);
    const weekEnd = computeWeekEndLocalDate(weekStart);
    const onlyClosedWeeks = parseOnlyClosedWeeks(query.onlyClosedWeeks);

    const filters: LaborPayBillingFilters = {
      weekStart,
      weekEnd,
      serviceClientId: query.serviceClientId,
      locationId: query.locationId,
      employeeId: query.employeeId,
      onlyClosedWeeks
    };

    const locations = await this.prisma.location.findMany({
      where: {
        companyId,
        ...this.companyScopeService.buildLocationEntityFilter(access)
      },
      select: { id: true, name: true, timezone: true, archivedAt: true }
    });

    const closeTimeZone = resolveCompanyCloseTimeZone(locations);
    const bounds = weekRangeToUtcBounds(weekStart, closeTimeZone);

    const weeklyPeriod = await this.prisma.weeklyPeriod.findUnique({
      where: {
        companyId_weekStartLocalDate: {
          companyId,
          weekStartLocalDate: weekStart
        }
      },
      include: {
        snapshots: {
          orderBy: { version: "desc" },
          take: 1
        }
      }
    });

    let dataSource: LaborPayBillingPreview["dataSource"] = "none";
    let snapshotVersion: number | null = null;
    let shiftRows: ShiftLaborRow[] = [];

    if (weeklyPeriod?.status === WeeklyPeriodStatus.CLOSED && weeklyPeriod.snapshots[0]) {
      dataSource = "closed_snapshot";
      snapshotVersion = weeklyPeriod.snapshots[0].version;
      shiftRows = await this.loadSnapshotRows(
        weeklyPeriod.snapshots[0].snapshotPayload as SnapshotPayload,
        filters
      );
    } else if (onlyClosedWeeks) {
      dataSource = "none";
      shiftRows = [];
    } else {
      dataSource = "live_approved";
      shiftRows = await this.loadLiveApprovedRows(companyId, bounds, access, filters);
    }

    const excludedShifts = onlyClosedWeeks
      ? []
      : await this.loadExcludedShiftWarnings(companyId, bounds, access, filters);

    const employeePayPrep = aggregateEmployeePayRows(shiftRows, weekStart, weekEnd);
    const clientLaborBilling = aggregateClientLaborBillingRows(shiftRows, weekStart, weekEnd);

    return {
      company: { id: access.company.id, name: access.company.name },
      periodStart: weekStart,
      periodEnd: weekEnd,
      weekStatus: weeklyPeriod?.status ?? WeeklyPeriodStatus.OPEN,
      dataSource,
      dataSourceLabel: dataSourceLabel(dataSource),
      snapshotVersion,
      currencyCode: (
        await this.prisma.company.findUniqueOrThrow({
          where: { id: companyId },
          select: { currencyCode: true }
        })
      ).currencyCode,
      employeePayPrep,
      clientLaborBilling,
      excludedShifts,
      totals: summarizeLaborRows(shiftRows),
      filters,
      draftSupported: false
    };
  }

  async getEmployeePayCsv(principal: AuthenticatedPrincipal, companyId: string, query: PreviewQuery) {
    const preview = await this.getPreview(principal, companyId, query);
    return buildEmployeePayCsv(preview.employeePayPrep);
  }

  async getClientBillingCsv(principal: AuthenticatedPrincipal, companyId: string, query: PreviewQuery) {
    const preview = await this.getPreview(principal, companyId, query);
    const weekStart = parseWeekStartLocalDate(query.weekStart);
    const access = await this.companyScopeService.getCompanyAccessContext(principal, companyId);
    const locations = await this.prisma.location.findMany({
      where: {
        companyId,
        ...this.companyScopeService.buildLocationEntityFilter(access)
      },
      select: { id: true, timezone: true }
    });
    const closeTimeZone = resolveCompanyCloseTimeZone(locations);
    const bounds = weekRangeToUtcBounds(weekStart, closeTimeZone);
    const allowedLocationIds = access.unrestrictedLocations
      ? undefined
      : access.allowedLocationIds;

    const assignments = await this.prisma.laborWorkAssignment.findMany({
      where: {
        companyId,
        startedAt: { gte: bounds.startUtc, lt: bounds.endUtc },
        ...(allowedLocationIds ? { locationId: { in: allowedLocationIds } } : {}),
        ...(query.locationId ? { locationId: query.locationId } : {}),
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.serviceClientId ? { serviceClientId: query.serviceClientId } : {})
      },
      orderBy: { startedAt: "asc" }
    });

    if (assignments.length === 0) {
      return buildClientBillingCsv(preview.clientLaborBilling);
    }

    const contextRows = assignments.map((assignment) => {
      const billingRow = preview.clientLaborBilling.find(
        (row) =>
          row.employeeId === assignment.employeeId &&
          row.locationId === assignment.locationId &&
          row.serviceClientId === assignment.serviceClientId
      );

      const fallbackBilling = billingRow ?? {
        serviceClientId: assignment.serviceClientId,
        serviceClientName: assignment.clientNameSnapshot,
        locationId: assignment.locationId,
        locationName: assignment.locationNameSnapshot,
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeNameSnapshot,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        approvedBillableMinutes: 0,
        approvedBillableHoursDecimal: 0,
        clientLaborRateMinor: DEFAULT_CLIENT_RATE_MINOR,
        estimatedClientChargeMinor: 0,
        estimatedGrossPayMinor: 0,
        estimatedMarginMinor: 0,
        shiftCount: 0,
        warnings: [] as string[]
      };

      return buildClientBillingWorkContextRow(fallbackBilling, weekStart, assignment);
    });

    return buildClientBillingCsvWithWorkContext(contextRows);
  }

  createDraft() {
    throw new NotImplementedException(
      "Labor billing drafts are deferred to LABOR-PAY-BILL02. Preview and CSV export are available."
    );
  }

  private async validateFilters(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: PreviewQuery
  ) {
    await this.companyScopeService.assertLocationFilterAllowed(
      principal,
      companyId,
      query.locationId
    );

    if (query.serviceClientId) {
      const client = await this.prisma.serviceClient.findFirst({
        where: { id: query.serviceClientId, companyId },
        select: { id: true }
      });

      if (!client) {
        throw new BadRequestException("Service client must belong to the selected company.");
      }
    }

    if (query.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: query.employeeId, companyId },
        select: { id: true }
      });

      if (!employee) {
        throw new BadRequestException("Employee must belong to the selected company.");
      }
    }
  }

  private async loadSnapshotRows(payload: SnapshotPayload, filters: LaborPayBillingFilters) {
    const snapshotShifts = payload.shifts ?? [];
    if (snapshotShifts.length === 0) {
      return [];
    }

    const employeeIds = [...new Set(snapshotShifts.map((row) => row.employeeId))];
    const locationIds = [...new Set(snapshotShifts.map((row) => row.locationId))];
    const serviceClientIds = [...new Set(snapshotShifts.map((row) => row.serviceClientId))];

    const [employees, locations, serviceClients] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, fullName: true }
      }),
      this.prisma.location.findMany({
        where: { id: { in: locationIds } },
        select: { id: true, name: true }
      }),
      this.prisma.serviceClient.findMany({
        where: { id: { in: serviceClientIds } },
        select: { id: true, name: true }
      })
    ]);

    const employeeById = new Map(employees.map((row) => [row.id, row.fullName]));
    const locationById = new Map(locations.map((row) => [row.id, row.name]));
    const clientById = new Map(serviceClients.map((row) => [row.id, row.name]));

    return snapshotShifts
      .filter((row) =>
        matchesLaborFilters(row, filters)
      )
      .map((row) => ({
        shiftId: row.shiftId,
        employeeId: row.employeeId,
        employeeName: employeeById.get(row.employeeId) ?? "Unknown employee",
        locationId: row.locationId,
        locationName: locationById.get(row.locationId) ?? "Unknown location",
        serviceClientId: row.serviceClientId,
        serviceClientName: clientById.get(row.serviceClientId) ?? "Unknown client",
        payableMinutes: row.payableMinutes,
        employeeRateMinor: row.employeeRateMinor,
        clientRateMinor: row.clientRateMinor,
        employeeAmountMinor: row.employeeAmountMinor,
        clientAmountMinor: row.clientAmountMinor,
        grossMarginMinor: row.grossMarginMinor
      }));
  }

  private async loadLiveApprovedRows(
    companyId: string,
    bounds: { from: string; to: string },
    access: Awaited<ReturnType<CompanyScopeService["getCompanyAccessContext"]>>,
    filters: LaborPayBillingFilters
  ) {
    const locationScope = this.companyScopeService.buildLocationIdFilter(access, filters.locationId);

    const shifts = await this.prisma.shift.findMany({
      where: {
        companyId,
        status: ShiftStatus.SCHEDULED,
        approvedAt: { not: null },
        punchEvents: { some: {} },
        scheduledStartUtc: {
          gte: new Date(bounds.from),
          lt: new Date(bounds.to)
        },
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.serviceClientId ? { serviceClientId: filters.serviceClientId } : {}),
        ...locationScope
      },
      include: shiftInclude,
      orderBy: { scheduledStartUtc: "asc" }
    });

    const rows: ShiftLaborRow[] = [];

    for (const shift of shifts) {
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

      if (!shift.approvedAt || review.payableMinutes === null) {
        continue;
      }

      const rateAt = review.clockOutUtc ?? shift.scheduledEndUtc;
      const [employeeRateMinor, clientRateMinor] = await Promise.all([
        this.resolveEmployeeRateMinor(shift.employeeId, rateAt),
        this.resolveClientRateMinor(shift.serviceClientId, rateAt)
      ]);

      const employeeAmountMinor = estimateAmountMinor(review.payableMinutes, employeeRateMinor) ?? 0;
      const clientAmountMinor = estimateAmountMinor(review.payableMinutes, clientRateMinor) ?? 0;

      rows.push({
        shiftId: shift.id,
        employeeId: shift.employeeId,
        employeeName: shift.employee.fullName,
        locationId: shift.locationId,
        locationName: shift.location.name,
        serviceClientId: shift.serviceClientId,
        serviceClientName: shift.serviceClient.name,
        payableMinutes: review.payableMinutes,
        employeeRateMinor,
        clientRateMinor,
        employeeAmountMinor,
        clientAmountMinor,
        grossMarginMinor: clientAmountMinor - employeeAmountMinor
      });
    }

    return rows;
  }

  private async loadExcludedShiftWarnings(
    companyId: string,
    bounds: { from: string; to: string },
    access: Awaited<ReturnType<CompanyScopeService["getCompanyAccessContext"]>>,
    filters: LaborPayBillingFilters
  ) {
    const locationScope = this.companyScopeService.buildLocationIdFilter(access, filters.locationId);

    const shifts = await this.prisma.shift.findMany({
      where: {
        companyId,
        status: ShiftStatus.SCHEDULED,
        punchEvents: { some: {} },
        scheduledStartUtc: {
          gte: new Date(bounds.from),
          lt: new Date(bounds.to)
        },
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.serviceClientId ? { serviceClientId: filters.serviceClientId } : {}),
        ...locationScope
      },
      include: shiftInclude
    });

    const warnings: ExcludedShiftWarning[] = [];

    for (const shift of shifts) {
      if (shift.approvedAt) {
        continue;
      }

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

      const primaryWarning = review.warnings.find((warning) =>
        [
          "missing_clock_in",
          "missing_clock_out",
          "open_break",
          "invalid_punch_sequence",
          "additional_time_pending",
          "incomplete_shift"
        ].includes(warning.code)
      );

      if (primaryWarning) {
        warnings.push({
          shiftId: shift.id,
          employeeName: shift.employee.fullName,
          locationName: shift.location.name,
          reasonCode: primaryWarning.code,
          message: primaryWarning.message
        });
        continue;
      }

      if (review.displayStatus !== "approved") {
        warnings.push({
          shiftId: shift.id,
          employeeName: shift.employee.fullName,
          locationName: shift.location.name,
          reasonCode: "unapproved_shift",
          message: "Shift is not approved and is excluded from pay prep and client billing."
        });
      }
    }

    return warnings;
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
}
