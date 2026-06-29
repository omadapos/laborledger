import type { GlobalRole } from "@prisma/client";

export type AuthenticatedPrincipal = {
  userId: string;
  email: string;
  globalRole: GlobalRole;
  groupOwnerGroupIds: string[];
  companyAdminCompanyIds: string[];
  supervisorCompanyIds: string[];
  sessionId: string;
  activeCompanyId: string | null;
};

export type RequestWithPrincipal = {
  headers: Record<string, string | string[] | undefined>;
  principal?: AuthenticatedPrincipal;
  sessionToken?: string;
};
