"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AccessibleCompanyRecord, AuthMeResponse } from "../lib/auth-utils";
import { formatActiveCompanyLabel } from "../lib/auth-utils";
import { isPlatformSuperadmin } from "../lib/platform-customer-utils";

type AdminSessionBarProps = {
  readonly session: AuthMeResponse;
  readonly showPlatformLink?: boolean;
};

export function AdminSessionBar({ session, showPlatformLink = true }: AdminSessionBarProps) {
  const router = useRouter();
  const [isSwitching, setIsSwitching] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeCompany = session.activeCompany;
  const switchableCompanies = session.accessibleCompanies.filter(
    (company) => company.id !== activeCompany?.id
  );

  async function handleSwitchCompany(company: AccessibleCompanyRecord) {
    setErrorMessage(null);
    setIsSwitching(true);

    const response = await fetch("/api/auth/select-company", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ companyId: company.id })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setErrorMessage(payload.message ?? "Unable to switch company.");
      setIsSwitching(false);
      return;
    }

    router.refresh();
    setIsSwitching(false);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="mx-auto flex max-w-[88rem] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
            Signed in as {session.user.email}
          </p>
          <p className="truncate text-sm font-medium text-slate-900">
            {formatActiveCompanyLabel(activeCompany)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showPlatformLink && isPlatformSuperadmin(session.user.globalRole) ? (
            <Link
              href="/platform/customers"
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100"
            >
              Customers
            </Link>
          ) : null}

          {switchableCompanies.length > 0 ? (
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                {isSwitching ? "Switching…" : "Switch company"}
              </summary>
              <div className="absolute right-0 z-20 mt-2 min-w-[16rem] rounded-xl border border-slate-200 bg-white p-2 shadow-lg shadow-slate-200/60">
                <ul className="space-y-1">
                  {switchableCompanies.map((company) => (
                    <li key={company.id}>
                      <button
                        type="button"
                        disabled={isSwitching}
                        onClick={() => handleSwitchCompany(company)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="block font-medium">{company.name}</span>
                        <span className="block text-xs text-slate-500">{company.accessLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          ) : null}

          <button
            type="button"
            onClick={() => router.push("/choose-company")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Choose company
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <p className="mx-auto mt-3 max-w-[88rem] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
