import type { ReactNode } from "react";
import Link from "next/link";

type PlatformShellProps = {
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
};

export function PlatformShell({ title, description, actions, children }: PlatformShellProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-[88rem] gap-0 lg:gap-8 lg:px-8 lg:py-8">
        <aside className="hidden w-[17rem] shrink-0 flex-col rounded-xl border border-slate-800/80 bg-slate-950 p-4 md:flex">
          <div className="mb-6 px-2 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-xs font-semibold text-white">
                SH
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">LaborLedger</p>
                <h2 className="text-base font-semibold text-white">Platform</h2>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">SaaS customer onboarding</p>
          </div>

          <nav className="flex flex-col gap-0.5">
            <Link
              href="/platform/customers"
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white"
            >
              Customers
            </Link>
            <Link
              href="/employees"
              className="rounded-lg px-3 py-2 text-sm font-normal text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            >
              Back to workspace
            </Link>
          </nav>

          <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-[11px] text-slate-500">
            Platform superadmin only
          </div>
        </aside>

        <div className="flex min-h-full flex-1 flex-col">
          <header className="border-b border-slate-200/70 bg-white px-5 py-5 lg:mb-6 lg:rounded-xl lg:border lg:shadow-sm lg:shadow-slate-200/40">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Platform</p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
                <p className="text-sm text-slate-600">{description}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
            </div>
          </header>

          <main className="flex-1 px-5 pb-8 lg:px-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
