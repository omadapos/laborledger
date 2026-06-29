export type CompanyAccessContext = {
  companyId: string;
  accessLevel: "platform" | "group_owner" | "company_admin" | "supervisor";
  unrestrictedLocations: boolean;
  allowedLocationIds: string[];
  canManageCompany: boolean;
  canAccessWeeklyClose: boolean;
  canAccessKioskAdmin: boolean;
};

export const NO_ASSIGNED_LOCATIONS_MESSAGE =
  "No locations are assigned to your supervisor account. Ask a company administrator to assign locations before reviewing time.";

export const SUPERVISOR_FORBIDDEN_MESSAGE =
  "This area is limited to company administrators and group owners.";

export function isSupervisorAccess(access: CompanyAccessContext) {
  return access.accessLevel === "supervisor";
}

export function hasAssignedLocations(access: CompanyAccessContext) {
  return access.unrestrictedLocations || access.allowedLocationIds.length > 0;
}

export function supervisorScopeEmptyMessage(access: CompanyAccessContext) {
  if (!isSupervisorAccess(access) || hasAssignedLocations(access)) {
    return null;
  }

  return NO_ASSIGNED_LOCATIONS_MESSAGE;
}

export function filterLocationsForAccess<T extends { id: string }>(
  locations: T[],
  access: CompanyAccessContext
) {
  if (access.unrestrictedLocations) {
    return locations;
  }

  const allowed = new Set(access.allowedLocationIds);
  return locations.filter((location) => allowed.has(location.id));
}
