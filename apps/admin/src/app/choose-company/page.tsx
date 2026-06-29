import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ChooseCompanyClient } from "../../components/choose-company-client";
import { fetchAuthMe, WorkspaceApiError } from "../../lib/workspace-auth";

type ChooseCompanyPageProps = {
  readonly searchParams?: Promise<{
    blocked?: string;
    reason?: string;
  }>;
};

export default async function ChooseCompanyPage({ searchParams }: ChooseCompanyPageProps) {
  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader.includes("laborledger.sid=")) {
    redirect("/login");
  }

  let session;

  try {
    session = await fetchAuthMe(cookieHeader);
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  const query = (await searchParams) ?? {};
  const blocked = query.blocked === "1" || session.accessibleCompanies.length === 0;
  const blockedReason =
    query.reason === "suspended" || query.reason === "archived" ? query.reason : "none";

  if (!blocked && session.accessibleCompanies.length === 1 && !session.activeCompany) {
    redirect("/employees");
  }

  if (!blocked && session.activeCompany && !session.requiresCompanySelection) {
    redirect("/employees");
  }

  return (
    <ChooseCompanyClient
      companies={session.accessibleCompanies}
      blocked={blocked}
      blockedReason={blockedReason}
      userEmail={session.user.email}
    />
  );
}
