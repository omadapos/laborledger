import {
  buildWorkOrderListQuery,
  formatWorkOrderDate,
  formatWorkOrderStatusLabel,
  type WorkOrderListRecord,
  type WorkOrderStatus
} from "./work-order-utils";
import { formatVehicleTitle } from "./vehicle-utils";

export const JOBS_PAGE_TITLE = "Company jobs";
export const JOBS_PAGE_DESCRIPTION =
  "Company-scoped work orders for the active company. Newest jobs appear first.";
export const JOBS_RECEIVE_VEHICLE_CTA = "Receive vehicle";
export const JOBS_EMPTY_TITLE = "No jobs yet";
export const JOBS_EMPTY_DESCRIPTION =
  "No jobs yet. Receive a vehicle to create the first work order.";
export const JOBS_FILTERED_EMPTY_TITLE = "No matching jobs found";
export const JOBS_FILTERED_EMPTY_DESCRIPTION =
  "Try adjusting your filters or clearing the search.";
export const JOBS_CLEAR_FILTERS_CTA = "Clear filters";

export type JobsListFilters = {
  q?: string;
  status?: string;
  serviceClientId?: string;
  locationId?: string;
};

export function jobsRoute() {
  return "/jobs";
}

export function jobDetailRoute(workOrderId: string) {
  return `/jobs/${encodeURIComponent(workOrderId)}`;
}

export function receptionRoute() {
  return "/reception";
}

export { buildWorkOrderListQuery };

export function hasActiveJobsFilters(filters: JobsListFilters) {
  return Boolean(
    filters.q?.trim() ||
      filters.status ||
      filters.serviceClientId ||
      filters.locationId
  );
}

export function jobsEmptyMessage(filters: JobsListFilters) {
  if (hasActiveJobsFilters(filters)) {
    return {
      title: JOBS_FILTERED_EMPTY_TITLE,
      description: JOBS_FILTERED_EMPTY_DESCRIPTION
    };
  }

  return {
    title: JOBS_EMPTY_TITLE,
    description: JOBS_EMPTY_DESCRIPTION
  };
}

export function buildJobsClearFiltersHref() {
  return jobsRoute();
}

export function formatJobStatusLabel(status: WorkOrderStatus) {
  return formatWorkOrderStatusLabel(status);
}

export function formatJobInvoiceStatus(status: WorkOrderStatus) {
  if (status === "INVOICED") {
    return "Invoiced";
  }

  if (status === "COMPLETED") {
    return "Ready to invoice";
  }

  if (status === "CANCELLED") {
    return "Not billable";
  }

  return "Not invoiced";
}

export function countAssignedWorkers(workOrder: Pick<WorkOrderListRecord, "assignments">) {
  const assignments = workOrder.assignments ?? [];
  const activeEmployeeIds = new Set(
    assignments.filter((assignment) => assignment.unassignedAt === null).map((assignment) => assignment.employeeId)
  );

  return activeEmployeeIds.size;
}

export function formatJobVehicleSummary(workOrder: Pick<WorkOrderListRecord, "vehicle">) {
  return `${formatVehicleTitle(workOrder.vehicle)} · ${workOrder.vehicle.vin}`;
}

export function formatJobCreatedAt(value?: string | null) {
  return formatWorkOrderDate(value);
}

export function formatJobCompletedAt(workOrder: WorkOrderListRecord) {
  const completedLine = workOrder.serviceLines.find((line) => line.activeCompletion);
  return formatWorkOrderDate(completedLine?.activeCompletion?.completedAt ?? null);
}

export function isVinSearchQuery(query: string) {
  const normalized = query.trim().toUpperCase();
  return normalized.length >= 3;
}
