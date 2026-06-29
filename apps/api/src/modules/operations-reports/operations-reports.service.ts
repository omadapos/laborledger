import { Inject, Injectable } from "@nestjs/common";
import {
  ClientInvoiceStatus,
  WorkOrderStatus,
  type Prisma
} from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { resolveOperationsReportDateRange } from "./operations-reports-date-range";

const COMPLETED_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.INVOICED
];

const PENDING_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.DRAFT,
  WorkOrderStatus.READY
];

const IN_PROGRESS_WORK_ORDER_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS
];

@Injectable()
export class OperationsReportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async getOperationsSummary(
    principal: AuthenticatedPrincipal,
    companyId: string,
    query: { from?: string; to?: string }
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const dateRange = resolveOperationsReportDateRange(query.from, query.to);
    const completionWhere = this.completionRangeWhere(companyId, dateRange);

    const [
      completionsInRange,
      issuedInvoicesInRange,
      voidedInvoicesInRange,
      workOrderStatusGroups,
      invoiceStatusGroups,
      pendingWorkOrderCount,
      inProgressWorkOrderCount,
      uninvoicedCompletedWorkOrders,
      assignmentsInRange,
      responsibilityScansInRange,
      invoiceLinesInRange
    ] = await Promise.all([
      this.prisma.serviceCompletion.findMany({
        where: completionWhere,
        select: {
          workOrderId: true,
          workOrderServiceLineId: true,
          employeeId: true,
          completedAt: true,
          employee: { select: { id: true, fullName: true } },
          workOrder: {
            select: {
              id: true,
              vehicleId: true,
              serviceClientId: true,
              status: true,
              workOrderNumber: true,
              serviceClient: { select: { id: true, name: true } },
              serviceLines: { select: { id: true } }
            }
          },
          workOrderServiceLine: {
            select: {
              serviceNameSnapshot: true,
              serviceCategorySnapshot: true
            }
          }
        }
      }),
      this.prisma.clientInvoice.findMany({
        where: {
          companyId,
          issuedAt: {
            gte: dateRange.fromUtc,
            lt: dateRange.toUtcExclusive
          }
        },
        select: {
          id: true,
          serviceClientId: true,
          status: true,
          totalMinor: true,
          issuedAt: true,
          serviceClient: { select: { id: true, name: true } }
        }
      }),
      this.prisma.clientInvoice.findMany({
        where: {
          companyId,
          status: ClientInvoiceStatus.VOID,
          voidedAt: {
            gte: dateRange.fromUtc,
            lt: dateRange.toUtcExclusive
          }
        },
        select: {
          id: true,
          serviceClientId: true,
          totalMinor: true,
          voidedAt: true,
          serviceClient: { select: { id: true, name: true } }
        }
      }),
      this.prisma.workOrder.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true }
      }),
      this.prisma.clientInvoice.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { _all: true },
        _sum: { totalMinor: true }
      }),
      this.prisma.workOrder.count({
        where: {
          companyId,
          status: { in: PENDING_WORK_ORDER_STATUSES }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          companyId,
          status: { in: IN_PROGRESS_WORK_ORDER_STATUSES }
        }
      }),
      this.prisma.workOrder.findMany({
        where: {
          companyId,
          status: WorkOrderStatus.COMPLETED,
          clientInvoiceLines: { none: {} },
          invoicedClientInvoiceId: null
        },
        select: {
          id: true,
          workOrderNumber: true,
          serviceClient: { select: { id: true, name: true } },
          updatedAt: true
        },
        orderBy: { updatedAt: "desc" },
        take: 10
      }),
      this.prisma.workOrderAssignment.findMany({
        where: {
          companyId,
          assignedAt: {
            gte: dateRange.fromUtc,
            lt: dateRange.toUtcExclusive
          }
        },
        select: {
          employeeId: true,
          workOrderId: true,
          employee: { select: { id: true, fullName: true } }
        }
      }),
      this.prisma.workerScanEvent.findMany({
        where: {
          companyId,
          matchedVin: true,
          acceptedAt: {
            gte: dateRange.fromUtc,
            lt: dateRange.toUtcExclusive
          }
        },
        select: {
          employeeId: true,
          employee: { select: { id: true, fullName: true } }
        }
      }),
      this.prisma.clientInvoiceLine.findMany({
        where: {
          companyId,
          clientInvoice: {
            issuedAt: {
              gte: dateRange.fromUtc,
              lt: dateRange.toUtcExclusive
            }
          }
        },
        select: {
          serviceNameSnapshot: true,
          serviceCategorySnapshot: true,
          lineTotalMinor: true,
          clientInvoice: {
            select: {
              serviceClientId: true,
              status: true
            }
          }
        }
      })
    ]);

    const uninvoicedCompletedWorkOrderCount = await this.prisma.workOrder.count({
      where: {
        companyId,
        status: WorkOrderStatus.COMPLETED,
        clientInvoiceLines: { none: {} },
        invoicedClientInvoiceId: null
      }
    });

    const completedWorkOrderIds = this.resolveCompletedWorkOrderIds(completionsInRange);
    const completedVehicleIds = new Set(
      completionsInRange
        .filter((completion) => completedWorkOrderIds.has(completion.workOrderId))
        .map((completion) => completion.workOrder.vehicleId)
    );

    const invoicedRevenueMinor = issuedInvoicesInRange.reduce(
      (sum, invoice) => sum + invoice.totalMinor,
      0
    );
    const voidedRevenueMinor = voidedInvoicesInRange.reduce(
      (sum, invoice) => sum + invoice.totalMinor,
      0
    );

    return {
      companyId: company.id,
      companyName: company.name,
      currencyCode: company.currencyCode,
      dateRange: {
        from: dateRange.from,
        to: dateRange.to,
        timezoneNote:
          "Date filters use UTC day boundaries (00:00:00Z inclusive through end of selected to date)."
      },
      metricDefinitions: {
        completedVehicles:
          "Distinct vehicles on work orders fully completed (all service lines) with final completion in range.",
        completedWorkOrders:
          "Work orders in COMPLETED or INVOICED status whose final active service completion falls in range.",
        completedServiceLines: "Active (non-voided) service completions with completedAt in range.",
        issuedInvoiceCount: "Invoices with issuedAt in range.",
        voidInvoiceCount: "Invoices voided (voidedAt) in range.",
        invoicedRevenueMinor: "Sum of totalMinor for invoices issued in range.",
        voidedRevenueMinor: "Sum of totalMinor for invoices voided in range.",
        netIssuedRevenueMinor: "invoicedRevenueMinor minus voidedRevenueMinor for the selected range.",
        pendingWorkOrderCount: "Current company work orders in DRAFT or READY status.",
        inProgressWorkOrderCount: "Current company work orders in ASSIGNED or IN_PROGRESS status.",
        uninvoicedCompletedWorkOrderCount:
          "Current COMPLETED work orders with no invoice lines and no invoicedClientInvoiceId."
      },
      kpis: {
        completedVehicles: completedVehicleIds.size,
        completedWorkOrders: completedWorkOrderIds.size,
        completedServiceLines: completionsInRange.length,
        issuedInvoiceCount: issuedInvoicesInRange.length,
        voidInvoiceCount: voidedInvoicesInRange.length,
        invoicedRevenueMinor,
        voidedRevenueMinor,
        netIssuedRevenueMinor: invoicedRevenueMinor - voidedRevenueMinor,
        pendingWorkOrderCount,
        inProgressWorkOrderCount,
        uninvoicedCompletedWorkOrderCount
      },
      revenue: {
        invoicedRevenueMinor,
        voidedRevenueMinor,
        netIssuedRevenueMinor: invoicedRevenueMinor - voidedRevenueMinor
      },
      workOrderStatusSummary: this.mapWorkOrderStatusSummary(workOrderStatusGroups),
      invoiceStatusSummary: this.mapInvoiceStatusSummary(invoiceStatusGroups),
      serviceClients: this.buildServiceClientBreakdown(
        completionsInRange,
        completedWorkOrderIds,
        issuedInvoicesInRange,
        invoiceLinesInRange
      ),
      services: this.buildServiceBreakdown(completionsInRange, invoiceLinesInRange),
      employees: this.buildEmployeeBreakdown(
        completionsInRange,
        assignmentsInRange,
        responsibilityScansInRange
      ),
      pendingWork: {
        pendingWorkOrderCount,
        inProgressWorkOrderCount,
        uninvoicedCompletedWorkOrderCount,
        sampleUninvoicedWorkOrders: uninvoicedCompletedWorkOrders.map((workOrder) => ({
          id: workOrder.id,
          workOrderNumber: workOrder.workOrderNumber,
          serviceClientName: workOrder.serviceClient.name,
          updatedAt: workOrder.updatedAt
        }))
      }
    };
  }

  private completionRangeWhere(
    companyId: string,
    dateRange: { fromUtc: Date; toUtcExclusive: Date }
  ): Prisma.ServiceCompletionWhereInput {
    return {
      companyId,
      voidedAt: null,
      completedAt: {
        gte: dateRange.fromUtc,
        lt: dateRange.toUtcExclusive
      }
    };
  }

  private resolveCompletedWorkOrderIds(
    completions: Array<{
      workOrderId: string;
      workOrderServiceLineId: string;
      completedAt: Date;
      workOrder: {
        status: WorkOrderStatus;
        serviceLines: Array<{ id: string }>;
      };
    }>
  ) {
    const byWorkOrder = new Map<
      string,
      {
        status: WorkOrderStatus;
        totalLines: number;
        completedLineIds: Set<string>;
        maxCompletedAt: Date;
      }
    >();

    for (const completion of completions) {
      const existing = byWorkOrder.get(completion.workOrderId) ?? {
        status: completion.workOrder.status,
        totalLines: completion.workOrder.serviceLines.length,
        completedLineIds: new Set<string>(),
        maxCompletedAt: completion.completedAt
      };

      existing.completedLineIds.add(completion.workOrderServiceLineId);
      if (completion.completedAt > existing.maxCompletedAt) {
        existing.maxCompletedAt = completion.completedAt;
      }

      byWorkOrder.set(completion.workOrderId, existing);
    }

    const completedIds = new Set<string>();
    for (const [workOrderId, summary] of byWorkOrder.entries()) {
      if (!COMPLETED_WORK_ORDER_STATUSES.includes(summary.status)) {
        continue;
      }

      if (summary.totalLines > 0 && summary.completedLineIds.size >= summary.totalLines) {
        completedIds.add(workOrderId);
      }
    }

    return completedIds;
  }

  private mapWorkOrderStatusSummary(
    groups: Array<{ status: WorkOrderStatus; _count: { _all: number } }>
  ) {
    const order: WorkOrderStatus[] = [
      WorkOrderStatus.DRAFT,
      WorkOrderStatus.READY,
      WorkOrderStatus.ASSIGNED,
      WorkOrderStatus.IN_PROGRESS,
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.INVOICED,
      WorkOrderStatus.CANCELLED
    ];
    const counts = new Map(groups.map((group) => [group.status, group._count._all]));

    return order.map((status) => ({
      status,
      count: counts.get(status) ?? 0
    }));
  }

  private mapInvoiceStatusSummary(
    groups: Array<{
      status: ClientInvoiceStatus;
      _count: { _all: number };
      _sum: { totalMinor: number | null };
    }>
  ) {
    const order: ClientInvoiceStatus[] = [
      ClientInvoiceStatus.DRAFT,
      ClientInvoiceStatus.ISSUED,
      ClientInvoiceStatus.VOID
    ];
    const byStatus = new Map(groups.map((group) => [group.status, group]));

    return order.map((status) => ({
      status,
      count: byStatus.get(status)?._count._all ?? 0,
      totalMinor: byStatus.get(status)?._sum.totalMinor ?? 0
    }));
  }

  private buildServiceClientBreakdown(
    completions: Array<{
      workOrderId: string;
      workOrder: {
        serviceClientId: string;
        serviceClient: { id: string; name: string };
      };
    }>,
    completedWorkOrderIds: Set<string>,
    issuedInvoices: Array<{
      serviceClientId: string;
      serviceClient: { id: string; name: string };
    }>,
    invoiceLines: Array<{
      lineTotalMinor: number;
      clientInvoice: { serviceClientId: string; status: ClientInvoiceStatus };
    }>
  ) {
    const clientNames = new Map<string, string>();
    for (const completion of completions) {
      clientNames.set(completion.workOrder.serviceClientId, completion.workOrder.serviceClient.name);
    }
    for (const invoice of issuedInvoices) {
      clientNames.set(invoice.serviceClientId, invoice.serviceClient.name);
    }

    const map = new Map<
      string,
      {
        serviceClientId: string;
        serviceClientName: string;
        completedWorkOrderIds: Set<string>;
        completedServiceLineCount: number;
        issuedInvoiceCount: number;
        revenueMinor: number;
      }
    >();

    const ensure = (serviceClientId: string, serviceClientName: string) => {
      const existing = map.get(serviceClientId) ?? {
        serviceClientId,
        serviceClientName,
        completedWorkOrderIds: new Set<string>(),
        completedServiceLineCount: 0,
        issuedInvoiceCount: 0,
        revenueMinor: 0
      };
      map.set(serviceClientId, existing);
      return existing;
    };

    for (const completion of completions) {
      const row = ensure(
        completion.workOrder.serviceClientId,
        completion.workOrder.serviceClient.name
      );
      row.completedServiceLineCount += 1;
      if (completedWorkOrderIds.has(completion.workOrderId)) {
        row.completedWorkOrderIds.add(completion.workOrderId);
      }
    }

    for (const invoice of issuedInvoices) {
      const row = ensure(invoice.serviceClientId, invoice.serviceClient.name);
      row.issuedInvoiceCount += 1;
    }

    for (const line of invoiceLines) {
      const row = ensure(
        line.clientInvoice.serviceClientId,
        clientNames.get(line.clientInvoice.serviceClientId) ?? "Unknown client"
      );
      row.revenueMinor += line.lineTotalMinor;
    }

    return [...map.values()]
      .map((row) => ({
        serviceClientId: row.serviceClientId,
        serviceClientName: row.serviceClientName,
        completedWorkOrderCount: row.completedWorkOrderIds.size,
        completedServiceLineCount: row.completedServiceLineCount,
        issuedInvoiceCount: row.issuedInvoiceCount,
        revenueMinor: row.revenueMinor
      }))
      .sort((left, right) => right.revenueMinor - left.revenueMinor || right.completedWorkOrderCount - left.completedWorkOrderCount);
  }

  private buildServiceBreakdown(
    completions: Array<{
      workOrderServiceLine: {
        serviceNameSnapshot: string;
        serviceCategorySnapshot: string | null;
      };
    }>,
    invoiceLines: Array<{
      serviceNameSnapshot: string;
      serviceCategorySnapshot: string | null;
      lineTotalMinor: number;
    }>
  ) {
    const map = new Map<
      string,
      {
        serviceName: string;
        serviceCategory: string | null;
        completedCount: number;
        revenueMinor: number;
      }
    >();

    const keyFor = (serviceName: string, serviceCategory: string | null) =>
      `${serviceName}::${serviceCategory ?? ""}`;

    for (const completion of completions) {
      const key = keyFor(
        completion.workOrderServiceLine.serviceNameSnapshot,
        completion.workOrderServiceLine.serviceCategorySnapshot
      );
      const row = map.get(key) ?? {
        serviceName: completion.workOrderServiceLine.serviceNameSnapshot,
        serviceCategory: completion.workOrderServiceLine.serviceCategorySnapshot,
        completedCount: 0,
        revenueMinor: 0
      };
      row.completedCount += 1;
      map.set(key, row);
    }

    for (const line of invoiceLines) {
      const key = keyFor(line.serviceNameSnapshot, line.serviceCategorySnapshot);
      const row = map.get(key) ?? {
        serviceName: line.serviceNameSnapshot,
        serviceCategory: line.serviceCategorySnapshot,
        completedCount: 0,
        revenueMinor: 0
      };
      row.revenueMinor += line.lineTotalMinor;
      map.set(key, row);
    }

    return [...map.values()].sort(
      (left, right) => right.completedCount - left.completedCount || right.revenueMinor - left.revenueMinor
    );
  }

  private buildEmployeeBreakdown(
    completions: Array<{
      employeeId: string;
      employee: { id: string; fullName: string };
    }>,
    assignments: Array<{
      employeeId: string;
      workOrderId: string;
      employee: { id: string; fullName: string };
    }>,
    scans: Array<{
      employeeId: string;
      employee: { id: string; fullName: string };
    }>
  ) {
    const map = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        completedServiceLineCount: number;
        assignedWorkOrderIds: Set<string>;
        responsibilityConfirmedCount: number;
      }
    >();

    const ensure = (employeeId: string, employeeName: string) => {
      const existing = map.get(employeeId) ?? {
        employeeId,
        employeeName,
        completedServiceLineCount: 0,
        assignedWorkOrderIds: new Set<string>(),
        responsibilityConfirmedCount: 0
      };
      map.set(employeeId, existing);
      return existing;
    };

    for (const completion of completions) {
      const row = ensure(completion.employeeId, completion.employee.fullName);
      row.completedServiceLineCount += 1;
    }

    for (const assignment of assignments) {
      const row = ensure(assignment.employeeId, assignment.employee.fullName);
      row.assignedWorkOrderIds.add(assignment.workOrderId);
    }

    for (const scan of scans) {
      const row = ensure(scan.employeeId, scan.employee.fullName);
      row.responsibilityConfirmedCount += 1;
    }

    return [...map.values()]
      .map((row) => ({
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        completedServiceLineCount: row.completedServiceLineCount,
        assignedWorkOrderCount: row.assignedWorkOrderIds.size,
        responsibilityConfirmedCount: row.responsibilityConfirmedCount
      }))
      .sort(
        (left, right) =>
          right.completedServiceLineCount - left.completedServiceLineCount ||
          right.responsibilityConfirmedCount - left.responsibilityConfirmedCount
      );
  }
}
