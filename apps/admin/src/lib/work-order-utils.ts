import type { CompanyRecord } from "./employee-utils";
import type { LocationRecord, ServiceClientRecord } from "./location-utils";
import type { ServiceCatalogListRecord } from "./service-catalog-utils";
import { formatVehicleTitle, type VehicleListRecord } from "./vehicle-utils";

export type WorkOrderStatus =
  | "DRAFT"
  | "READY"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "INVOICED"
  | "CANCELLED";

export type WorkOrderServiceLineRecord = {
  id: string;
  serviceCatalogItemId: string;
  serviceNameSnapshot: string;
  serviceCategorySnapshot: string | null;
  unitPriceMinor: number;
  currencyCode: string;
  quantity: number;
  lineTotalMinor: number;
  notes: string | null;
  activeCompletion?: ServiceLineCompletionRecord | null;
};

export type ServiceLineCompletionRecord = {
  id: string;
  completedAt: string;
  employee: { id: string; fullName: string };
};

export type WorkOrderStatusHistoryRecord = {
  id: string;
  fromStatus: WorkOrderStatus | null;
  toStatus: WorkOrderStatus;
  reason: string | null;
  createdAt: string;
};

export type WorkOrderAssignmentRecord = {
  id: string;
  employeeId: string;
  workOrderServiceLineId: string | null;
  roleLabel: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  unassignReason: string | null;
  employee: { id: string; fullName: string };
  workOrderServiceLine?: { id: string; serviceNameSnapshot: string } | null;
};

export type VehicleResponsibilityLogRecord = {
  id: string;
  employeeId: string | null;
  action: string;
  occurredAt: string;
  details: Record<string, unknown> | null;
  employee: { id: string; fullName: string } | null;
};

export type WorkerScanEventRecord = {
  id: string;
  employeeId: string;
  enteredVin: string;
  matchedVin: boolean;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  employee: { id: string; fullName: string };
};

export type LastResponsibilityConfirmationRecord = {
  scanEventId: string;
  employeeName: string;
  acceptedAt: string | null;
  enteredVin: string;
};

export type WorkOrderListRecord = {
  id: string;
  companyId: string;
  serviceClientId: string;
  locationId: string;
  vehicleId: string;
  workOrderNumber: string;
  status: WorkOrderStatus;
  notes: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt?: string;
  serviceLineCount: number;
  totalServiceAmountMinor: number;
  serviceClient: { id: string; name: string };
  location: { id: string; name: string; timezone: string; serviceClientId: string };
  vehicle: VehicleListRecord;
  serviceLines: WorkOrderServiceLineRecord[];
  statusHistory?: WorkOrderStatusHistoryRecord[];
  completedServiceLineCount?: number;
  completionProgressLabel?: string;
  assignedEmployee?: { id: string; fullName: string } | null;
  activeAssignmentId?: string | null;
  assignments?: WorkOrderAssignmentRecord[];
  responsibilityLogs?: VehicleResponsibilityLogRecord[];
  workerScanEvents?: WorkerScanEventRecord[];
  lastResponsibilityConfirmation?: LastResponsibilityConfirmationRecord | null;
};

export const WORK_ORDER_STATUS_OPTIONS: WorkOrderStatus[] = [
  "DRAFT",
  "READY",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "INVOICED",
  "CANCELLED"
];

export function formatWorkOrderStatusLabel(status: WorkOrderStatus) {
  if (status === "DRAFT") return "Draft";
  if (status === "READY") return "Ready";
  if (status === "ASSIGNED") return "Assigned";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "COMPLETED") return "Completed";
  if (status === "INVOICED") return "Invoiced";
  return "Cancelled";
}

export function formatServiceLineCompletionStatus(
  completion?: ServiceLineCompletionRecord | null
) {
  return completion ? "Completed" : "Pending";
}

export function formatServiceLineCompletionSummary(
  completion?: ServiceLineCompletionRecord | null
) {
  if (!completion) {
    return "Pending completion";
  }

  return `${completion.employee.fullName} · ${formatWorkOrderDate(completion.completedAt)}`;
}

export function formatWorkOrderCompletionProgress(workOrder: {
  completedServiceLineCount?: number;
  serviceLineCount?: number;
  completionProgressLabel?: string;
}) {
  if (workOrder.completionProgressLabel) {
    return workOrder.completionProgressLabel;
  }

  const completed = workOrder.completedServiceLineCount ?? 0;
  const total = workOrder.serviceLineCount ?? 0;
  return `${completed} of ${total} services completed`;
}

export function formatAssignedEmployeeLabel(
  assignedEmployee?: { fullName: string } | null
) {
  return assignedEmployee?.fullName ?? "Unassigned";
}

export function assignmentDisclaimer() {
  return "Assignments identify who is responsible for a vehicle/work order. They do not replace kiosk punches and are not payroll.";
}

export function formatResponsibilityLogAction(action: string) {
  if (action === "ASSIGNED") return "Assigned";
  if (action === "UNASSIGNED") return "Unassigned";
  if (action === "REASSIGNED") return "Reassigned";
  if (action === "RESPONSIBILITY_CONFIRMED") return "Responsibility confirmed";
  if (action === "SERVICE_COMPLETED") return "Service completed";
  if (action === "SCANNED") return "Scanned";
  return action.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

export function formatResponsibilityLogSummary(log: VehicleResponsibilityLogRecord) {
  const employeeName = log.employee?.fullName ?? "Unknown employee";
  return `${formatResponsibilityLogAction(log.action)} — ${employeeName}`;
}

export function formatWorkerScanSummary(scan: WorkerScanEventRecord) {
  const status = scan.matchedVin ? "Confirmed" : "Rejected";
  return `${status} — ${scan.employee.fullName} · ${scan.enteredVin}`;
}

export function formatLastResponsibilityConfirmation(
  confirmation?: LastResponsibilityConfirmationRecord | null
) {
  if (!confirmation?.acceptedAt) {
    return "No worker confirmation yet";
  }

  return `${confirmation.employeeName} confirmed ${confirmation.enteredVin}`;
}

export function formatWorkOrderMoney(minorUnits: number, currencyCode = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

export function formatWorkOrderDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export function workOrderDisclaimer() {
  return "Work orders organize vehicle services and service prices. They are not invoices, payroll, taxes, or payments.";
}

export function workOrdersEmptyMessage(hasAnyWorkOrders: boolean) {
  if (hasAnyWorkOrders) {
    return {
      title: "No work orders match your filters",
      description: "Try a different search, status, service client, or location filter."
    };
  }

  return {
    title: "No work orders yet",
    description:
      "Create a work order by selecting a VIN-backed vehicle and one or more active catalog services. Prices are snapshotted on the work order."
  };
}

export function formatWorkOrderVehicleSummary(vehicle: VehicleListRecord) {
  return `${formatVehicleTitle(vehicle)} · ${vehicle.vin}`;
}

export function sumServiceLineTotals(lines: Array<{ lineTotalMinor: number }>) {
  return lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
}

export function buildWorkOrderListQuery(options: {
  serviceClientId?: string;
  locationId?: string;
  status?: WorkOrderStatus;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (options.serviceClientId) {
    params.set("serviceClientId", options.serviceClientId);
  }
  if (options.locationId) {
    params.set("locationId", options.locationId);
  }
  if (options.status) {
    params.set("status", options.status);
  }
  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function filterActiveCatalogItems(items: ServiceCatalogListRecord[]) {
  return items.filter((item) => !item.archivedAt);
}

export function filterActiveVehicles(vehicles: VehicleListRecord[]) {
  return vehicles.filter((vehicle) => !vehicle.archivedAt);
}

export type { CompanyRecord, LocationRecord, ServiceClientRecord, ServiceCatalogListRecord, VehicleListRecord };
