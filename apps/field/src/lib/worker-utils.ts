export type WorkerAssignmentRecord = {
  assignmentId: string;
  workOrderId: string;
  workOrderNumber: string;
  status: string;
  vehicle: {
    vin: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
    color: string | null;
  };
  location: { id: string; name: string };
  serviceLines: Array<{
    id: string;
    serviceNameSnapshot: string;
    serviceCategorySnapshot: string | null;
    completion: {
      serviceCompletionId: string;
      completedAt: string;
      completedByEmployeeId: string;
      completedByEmployeeName: string;
    } | null;
  }>;
  lastConfirmation: {
    scanEventId: string;
    acceptedAt: string;
    enteredVin: string;
  } | null;
};

export function workerDisclaimer() {
  return "Confirming a vehicle assignment records responsibility for the job. It does not replace time clock punches.";
}

export function formatVehicleTitle(vehicle: WorkerAssignmentRecord["vehicle"]) {
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return title || "Vehicle";
}

export function formatAssignmentSummary(assignment: WorkerAssignmentRecord) {
  return `${assignment.workOrderNumber} · ${formatVehicleTitle(assignment.vehicle)}`;
}

export function workerEmptyAssignmentsMessage() {
  return {
    title: "No active assignments",
    description: "When a supervisor assigns you to a work order, it will appear here."
  };
}

export function formatServiceLineCompletionLabel(
  completion: WorkerAssignmentRecord["serviceLines"][number]["completion"]
) {
  return completion ? "Completed" : "Pending";
}

export function formatServiceLineCompletionDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

export function serviceCompletionSuccessMessage() {
  return "Service marked complete. This records responsibility for the work performed and does not replace time clock punches.";
}

export function canCompleteServiceLine(assignment: WorkerAssignmentRecord) {
  return Boolean(assignment.lastConfirmation?.acceptedAt);
}

export function serviceCompletionBlockedMessage() {
  return "Confirm the vehicle VIN first to record responsibility before completing services.";
}

export function normalizeVinInput(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-HJ-NPR-Z0-9]/g, "");
}
