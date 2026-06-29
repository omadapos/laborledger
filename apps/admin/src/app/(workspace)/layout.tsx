import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSessionBar } from "../../components/admin-session-bar";
import { AdminNav } from "../../components/admin-nav";
import { DesignV2Badge } from "../../components/admin-shell";
import { fetchAuthMe, WorkspaceApiError } from "../../lib/workspace-auth";
import { requireSessionCookie } from "../../lib/api-bff";

type WorkspaceLayoutProps = {
  readonly children: ReactNode;
};

export default async function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const cookieHeader = await requireSessionCookie();

  if (!cookieHeader) {
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

  if (session.requiresCompanySelection) {
    redirect("/choose-company");
  }

  return (
    <div>
      <AdminSessionBar session={session} />
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-800">LaborLedger Admin</p>
          <DesignV2Badge />
        </div>
        <AdminNav variant="mobile" />
      </div>
      {children}
    </div>
  );
}
