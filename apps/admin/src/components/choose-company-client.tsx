"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AccessibleCompanyRecord } from "../lib/auth-utils";
import { formatChooseCompanyBlockedCopy } from "../lib/auth-utils";
import { DesignV2Badge } from "./admin-shell";

type ChooseCompanyClientProps = {
  readonly companies: AccessibleCompanyRecord[];
  readonly blocked: boolean;
  readonly blockedReason?: "suspended" | "archived" | "none";
  readonly userEmail: string;
};

export function ChooseCompanyClient({
  companies,
  blocked,
  blockedReason = "none",
  userEmail
}: ChooseCompanyClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSelect(companyId: string) {
    setErrorMessage(null);
    setIsSubmitting(companyId);

    const response = await fetch("/api/auth/select-company", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ companyId })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setErrorMessage(payload.message ?? "Unable to select that company.");
      setIsSubmitting(null);
      return;
    }

    router.push("/employees");
    router.refresh();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/50">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">LaborLedger Admin</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Choose company</h1>
          </div>
          <DesignV2Badge />
        </div>

        <p className="text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{userEmail}</span>.
        </p>

        {blocked ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {formatChooseCompanyBlockedCopy(blockedReason === "none" ? undefined : blockedReason)}
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-slate-500">
              Select the company workspace you want to manage. You can switch later from the header.
            </p>

            <ul className="mt-6 space-y-3">
              {companies.map((company) => (
                <li key={company.id}>
                  <button
                    type="button"
                    disabled={isSubmitting !== null}
                    onClick={() => handleSelect(company.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{company.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">{company.accessLabel}</span>
                    </span>
                    <span className="text-xs font-medium text-brand-700">
                      {isSubmitting === company.id ? "Opening…" : "Open"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 text-sm font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
