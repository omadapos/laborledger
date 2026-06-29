import { formatClientInvoiceMoney } from "./client-invoice-utils";
import { formatWorkOrderStatusLabel } from "./work-order-utils";

export type OperationsReportDateRangeQuery = {
  from: string;
  to: string;
};

export type OperationsSummaryReport = {
  companyId: string;
  companyName: string;
  currencyCode: string;
  dateRange: {
    from: string;
    to: string;
    timezoneNote: string;
  };
  metricDefinitions: Record<string, string>;
  kpis: {
    completedVehicles: number;
    completedWorkOrders: number;
    completedServiceLines: number;
    issuedInvoiceCount: number;
    voidInvoiceCount: number;
    invoicedRevenueMinor: number;
    voidedRevenueMinor: number;
    netIssuedRevenueMinor: number;
    pendingWorkOrderCount: number;
    inProgressWorkOrderCount: number;
    uninvoicedCompletedWorkOrderCount: number;
  };
  revenue: {
    invoicedRevenueMinor: number;
    voidedRevenueMinor: number;
    netIssuedRevenueMinor: number;
  };
  workOrderStatusSummary: Array<{ status: string; count: number }>;
  invoiceStatusSummary: Array<{ status: string; count: number; totalMinor: number }>;
  serviceClients: Array<{
    serviceClientId: string;
    serviceClientName: string;
    completedWorkOrderCount: number;
    completedServiceLineCount: number;
    issuedInvoiceCount: number;
    revenueMinor: number;
  }>;
  services: Array<{
    serviceName: string;
    serviceCategory: string | null;
    completedCount: number;
    revenueMinor: number;
  }>;
  employees: Array<{
    employeeId: string;
    employeeName: string;
    completedServiceLineCount: number;
    assignedWorkOrderCount: number;
    responsibilityConfirmedCount: number;
  }>;
  pendingWork: {
    pendingWorkOrderCount: number;
    inProgressWorkOrderCount: number;
    uninvoicedCompletedWorkOrderCount: number;
    sampleUninvoicedWorkOrders: Array<{
      id: string;
      workOrderNumber: string;
      serviceClientName: string;
      updatedAt: string;
    }>;
  };
};

export const OPERATIONS_REPORTS_DISCLAIMER =
  "Reports are operational summaries. They do not calculate payroll, taxes, payments, or accounting entries.";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

function formatDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentMonthStartUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function resolveDefaultOperationsReportRange(): OperationsReportDateRangeQuery {
  return {
    from: formatDateKey(currentMonthStartUtc()),
    to: formatDateKey(new Date())
  };
}

export function buildOperationsReportQuery(range: OperationsReportDateRangeQuery) {
  const params = new URLSearchParams();
  params.set("from", range.from);
  params.set("to", range.to);
  return `?${params.toString()}`;
}

export function parseOperationsReportSearchParams(searchParams: {
  from?: string;
  to?: string;
}): OperationsReportDateRangeQuery {
  const defaults = resolveDefaultOperationsReportRange();
  const from = searchParams.from?.trim() || defaults.from;
  const to = searchParams.to?.trim() || defaults.to;

  return { from, to };
}

export function validateOperationsReportDateInput(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

export function formatOperationsReportMoney(minorUnits: number, currencyCode = "USD") {
  if (currencyCode === "USD") {
    return formatClientInvoiceMoney(minorUnits);
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatOperationsReportKpiValue(label: string, value: number, currencyCode = "USD") {
  if (label.toLowerCase().includes("revenue")) {
    return formatOperationsReportMoney(value, currencyCode);
  }

  return String(value);
}

export function formatInvoiceStatusLabel(status: string) {
  if (status === "DRAFT") {
    return "Draft";
  }

  if (status === "ISSUED") {
    return "Issued";
  }

  if (status === "VOID") {
    return "Void";
  }

  return status;
}

export function formatWorkOrderStatusSummaryLabel(status: string) {
  return formatWorkOrderStatusLabel(status as Parameters<typeof formatWorkOrderStatusLabel>[0]);
}

export function operationsReportsEmptyMessage(hasRange: boolean) {
  if (!hasRange) {
    return {
      title: "No report data yet",
      description: "Complete vehicle service work and issue client invoices to populate operational reports."
    };
  }

  return {
    title: "No activity in this date range",
    description: "Try a wider date range or confirm work orders were completed and invoices issued in the selected period."
  };
}

export function sortReportRowsByCount<T extends { count?: number; completedCount?: number; revenueMinor?: number }>(
  rows: T[]
) {
  return [...rows].sort((left, right) => {
    const leftCount = left.count ?? left.completedCount ?? 0;
    const rightCount = right.count ?? right.completedCount ?? 0;
    return rightCount - leftCount || (right.revenueMinor ?? 0) - (left.revenueMinor ?? 0);
  });
}

export function hasOperationsReportActivity(report: OperationsSummaryReport) {
  return (
    report.kpis.completedServiceLines > 0 ||
    report.kpis.issuedInvoiceCount > 0 ||
    report.kpis.completedWorkOrders > 0 ||
    report.workOrderStatusSummary.some((row) => row.count > 0)
  );
}
