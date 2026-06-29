import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { AccessibleCompanyRecord, AuthMeResponse } from "./auth-utils";

export const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export class WorkspaceApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`API request failed with status ${status}`);
    this.status = status;
  }
}

export async function apiGet<T>(path: string, cookieHeader: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        cookie: cookieHeader
      },
      cache: "no-store"
    });
  } catch {
    throw new WorkspaceApiError(0);
  }

  if (!response.ok) {
    throw new WorkspaceApiError(response.status);
  }

  return (await response.json()) as T;
}

export const fetchAuthMe = cache(async (cookieHeader: string) => {
  return apiGet<AuthMeResponse>("/auth/me", cookieHeader);
});

export type WorkspaceContext = {
  cookieHeader: string;
  session: AuthMeResponse;
  selectedCompany: AccessibleCompanyRecord;
  companies: AccessibleCompanyRecord[];
  blocked: false;
};

export type BlockedWorkspaceContext = {
  cookieHeader: string;
  session: AuthMeResponse;
  selectedCompany: null;
  companies: AccessibleCompanyRecord[];
  blocked: true;
};

export async function loadWorkspaceContext(): Promise<WorkspaceContext | BlockedWorkspaceContext> {
  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader.includes("laborledger.sid=")) {
    redirect("/login");
  }

  let session: AuthMeResponse;

  try {
    session = await fetchAuthMe(cookieHeader);
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  if (session.accessibleCompanies.length === 0) {
    return {
      cookieHeader,
      session,
      selectedCompany: null,
      companies: [],
      blocked: true
    };
  }

  if (session.requiresCompanySelection) {
    redirect("/choose-company");
  }

  const selectedCompany = session.activeCompany ?? session.accessibleCompanies[0];

  if (!selectedCompany) {
    redirect("/choose-company");
  }

  return {
    cookieHeader,
    session,
    selectedCompany,
    companies: session.accessibleCompanies,
    blocked: false
  };
}
