"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { FieldClockPanel } from "@/components/employee/FieldClockPanel";
import { EmployeeLaborWorkPanel } from "@/components/employee/EmployeeLaborWorkPanel";
import { StatusCard } from "@/components/shared/StatusCard";

type FieldMeResponse = {
  session?: {
    employeeName: string;
    companyName: string;
  };
  clockConfigured?: boolean;
  message?: string;
};

export function FieldHomePanel() {
  const router = useRouter();
  const [me, setMe] = useState<FieldMeResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadMe = useCallback(async () => {
    const response = await fetch("/api/field/me", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as FieldMeResponse & {
      message?: string;
    };

    if (!response.ok) {
      if (response.status === 401) {
        router.replace("/field/login");
        router.refresh();
        return;
      }
      setErrorMessage(payload.message ?? "Unable to load your session.");
      return;
    }

    setMe(payload);
  }, [router]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  async function handleSignOut() {
    setIsSigningOut(true);
    await fetch("/api/field/logout", { method: "POST" });
    router.replace("/field/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">
              {me?.session?.employeeName ?? "Loading…"}
            </p>
            <p className="text-sm text-slate-500">{me?.session?.companyName ?? ""}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      {errorMessage ? (
        <StatusCard title="Unable to load home" description={errorMessage} tone="warning" />
      ) : null}

      {!me?.clockConfigured ? (
        <StatusCard
          title="Clock not configured"
          description="Shift clock requires server-side location credentials. Ask your supervisor to configure this device."
          tone="warning"
        />
      ) : (
        <FieldClockPanel compact />
      )}

      <EmployeeLaborWorkPanel />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/field/jobs/new"
          className="rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm transition hover:border-brand-400"
        >
          <p className="text-base font-semibold text-slate-900">New Job</p>
          <p className="mt-1.5 text-sm text-slate-600">
            Scan or enter a VIN, confirm your assignment, and complete services.
          </p>
        </Link>
        <Link
          href="/field/summary"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <p className="text-base font-semibold text-slate-900">Summary</p>
          <p className="mt-1.5 text-sm text-slate-600">
            Review assignments, confirmations, and completed services.
          </p>
        </Link>
      </div>

      <Link
        href="/field/clock"
        className="inline-flex text-sm font-medium text-brand-700 underline"
      >
        Open full clock view
      </Link>
    </div>
  );
}
