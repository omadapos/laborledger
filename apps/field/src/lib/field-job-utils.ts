import { normalizeVinInput, type WorkerAssignmentRecord } from "./worker-utils";

export type FieldJobWorkflowStep =
  | "assignments"
  | "vin"
  | "customer"
  | "location"
  | "service"
  | "notes"
  | "done";

export function findAssignmentByVin(
  assignments: WorkerAssignmentRecord[],
  rawVin: string
): WorkerAssignmentRecord | null {
  const normalized = normalizeVinInput(rawVin);
  if (!normalized) {
    return null;
  }

  return assignments.find((assignment) => assignment.vehicle.vin === normalized) ?? null;
}

export function findAssignmentById(
  assignments: WorkerAssignmentRecord[],
  assignmentId: string
): WorkerAssignmentRecord | null {
  return assignments.find((assignment) => assignment.assignmentId === assignmentId) ?? null;
}

export function pendingServiceLines(assignment: WorkerAssignmentRecord) {
  return assignment.serviceLines.filter((line) => !line.completion);
}

export function assignmentRequiresLocationStep(assignment: WorkerAssignmentRecord) {
  return Boolean(assignment.location?.name);
}

export function fieldJobCreationRequiredMessage() {
  return "This job is not assigned to you yet. Ask your supervisor to assign the work order before you can start.";
}

export function fieldJobEmptyAssignmentsMessage() {
  return {
    title: "No assigned jobs",
    description:
      "When a supervisor assigns you to a job, it will appear here. You can also scan a VIN to find a matching assignment."
  };
}
