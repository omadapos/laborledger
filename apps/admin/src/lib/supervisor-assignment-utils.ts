export type CompanySupervisorRecord = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  assignedLocationCount: number;
};

export type SupervisorLocationAssignmentRecord = {
  id: string;
  companyId: string;
  supervisorUserId: string;
  locationId: string;
  assignedAt: string;
  supervisor: {
    id: string;
    email: string;
    fullName: string | null;
  };
  location: {
    id: string;
    name: string;
    timezone: string;
    archivedAt: string | null;
  };
};

export type LocationOption = {
  id: string;
  name: string;
  timezone: string;
  archivedAt?: string | null;
};

export const SUPERVISOR_ACCESS_HELPER_COPY =
  "Supervisors can only see and manage records for assigned locations.";

export const SUPERVISOR_PIN_HELPER_COPY =
  "Employee PIN users are managed separately and are not assigned here.";

export const SUPERVISOR_ROLE_HELPER_COPY =
  "Supervisor web users need an active supervisor membership in this company. Company administrator invitations above do not create supervisors.";

export function formatSupervisorLabel(supervisor: Pick<CompanySupervisorRecord, "fullName" | "email">) {
  return supervisor.fullName?.trim() || supervisor.email;
}

export function formatAssignedLocationCount(count: number): string {
  if (count === 0) {
    return "No locations assigned";
  }

  return `${count} assigned ${count === 1 ? "location" : "locations"}`;
}

export function groupAssignmentsBySupervisor(assignments: SupervisorLocationAssignmentRecord[]) {
  const grouped = new Map<string, SupervisorLocationAssignmentRecord[]>();

  for (const assignment of assignments) {
    const existing = grouped.get(assignment.supervisorUserId) ?? [];
    existing.push(assignment);
    grouped.set(assignment.supervisorUserId, existing);
  }

  return grouped;
}

export function buildAssignSupervisorLocationPath(
  companyId: string,
  supervisorUserId: string
): string {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations`;
}

export function buildRemoveSupervisorLocationPath(
  companyId: string,
  supervisorUserId: string,
  locationId: string
): string {
  return `/api/company-operations/companies/${encodeURIComponent(companyId)}/supervisors/${encodeURIComponent(supervisorUserId)}/locations/${encodeURIComponent(locationId)}`;
}

export function supervisorAccessEmptyMessage(
  supervisors: CompanySupervisorRecord[],
  locations: LocationOption[]
): { title: string; description: string } {
  if (locations.length === 0) {
    return {
      title: "No locations available",
      description: "Create an active location before assigning supervisor access."
    };
  }

  if (supervisors.length === 0) {
    return {
      title: "No supervisors yet",
      description:
        "Supervisor web users need an active supervisor company membership before location assignments can be managed."
    };
  }

  return {
    title: "No location assignments yet",
    description: "Assign one or more locations to each supervisor to scope their access."
  };
}

export function validateSupervisorAssignmentInput(supervisorUserId: string, locationId: string) {
  if (!supervisorUserId.trim()) {
    return "Select a supervisor.";
  }

  if (!locationId.trim()) {
    return "Select a location.";
  }

  return null;
}
