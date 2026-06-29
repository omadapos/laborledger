export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type UserInvitationRecord = {
  id: string;
  email: string;
  role: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  invitedBy: {
    id: string;
    fullName: string | null;
    email: string;
  };
};

export const USERS_PAGE_DESCRIPTION =
  "Invite company administrators and manage pending access invitations.";

export const USERS_PIN_HELPER_COPY =
  "This page is for admin web access. Kiosk employees continue to use PINs.";

export const USERS_ACCESS_TYPES = [
  {
    title: "Company administrators",
    description: "Web users invited above with full company management access."
  },
  {
    title: "Supervisors",
    description: "Web users with supervisor membership. Location access is managed below."
  },
  {
    title: "Employee PIN users",
    description: "Kiosk and worker employees managed on Employees. They do not sign in here."
  }
] as const;

export const PASSWORD_RESET_REQUEST_MESSAGE =
  "If an account exists for that email, reset instructions have been sent.";

export function formatInvitationStatus(status: InvitationStatus): string {
  if (status === "PENDING") {
    return "Pending";
  }

  if (status === "ACCEPTED") {
    return "Accepted";
  }

  if (status === "REVOKED") {
    return "Revoked";
  }

  return "Expired";
}

export function formatInvitationRole(role: string): string {
  if (role === "COMPANY_ADMIN") {
    return "Company admin";
  }

  return role.replace(/_/gu, " ").toLowerCase();
}

export function formatInvitedByLabel(
  invitedBy: UserInvitationRecord["invitedBy"] | null | undefined
): string {
  if (!invitedBy) {
    return "—";
  }

  return invitedBy.fullName?.trim() || invitedBy.email;
}

export function invitationStatusClassName(status: InvitationStatus): string {
  if (status === "PENDING") {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }

  if (status === "ACCEPTED") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  if (status === "REVOKED") {
    return "bg-slate-100 text-slate-700 border-slate-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
}

export function validateInviteEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return "Email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Za-z]/u.test(password) || !/[0-9]/u.test(password)) {
    return "Password must include at least one letter and one number.";
  }

  return null;
}
