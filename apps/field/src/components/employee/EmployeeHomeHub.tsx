import Link from "next/link";

import { StatusCard } from "@/components/shared/StatusCard";
import { isKioskConfigured } from "@/lib/kiosk-config";
import { isWorkerCompanyConfigured } from "@/lib/worker-config";

const ACTIONS = [
  {
    href: "/field/clock",
    label: "Clock",
    description: "Clock in, take breaks, and clock out for your shift.",
    primary: true
  },
  {
    href: "/field/jobs/new",
    label: "Start job",
    description: "Scan or enter a VIN, confirm your assignment, and complete services.",
    primary: true
  },
  {
    href: "/field/summary",
    label: "Summary",
    description: "Review assignments, confirmations, and completed services.",
    primary: false
  },
  {
    href: "/field/login",
    label: "Login",
    description: "Sign in with your PIN to load your assignments.",
    primary: false
  }
] as const;

export function EmployeeHomeHub() {
  const clockConfigured = isKioskConfigured();
  const jobsConfigured = isWorkerCompanyConfigured();

  return (
    <div className="space-y-4">
      <StatusCard
        title="Employee home"
        description="One app for your shift and vehicle service work. Sign in, clock in, complete jobs, then clock out."
        tone="neutral"
      />

      {!clockConfigured ? (
        <StatusCard
          title="Clock not configured"
          description="Time clock requires server-side location credentials. Ask your supervisor to configure this device."
          tone="warning"
        />
      ) : null}

      {!jobsConfigured ? (
        <StatusCard
          title="Sign-in not configured"
          description="This device needs server-side workplace configuration before employees can sign in with PIN."
          tone="warning"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={
              action.primary
                ? "rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm transition hover:border-brand-400"
                : "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            }
          >
            <p className="text-base font-semibold text-slate-900">{action.label}</p>
            <p className="mt-1.5 text-sm text-slate-600">{action.description}</p>
          </Link>
        ))}
      </div>

      <Link href="/field/offline" className="text-sm font-medium text-slate-600 underline">
        Offline guidance
      </Link>
    </div>
  );
}
