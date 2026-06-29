import type { ReactNode } from "react";

import { AdminNav } from "./admin-nav";

type AdminShellProps = {
  readonly title: string;
  readonly description: string;
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
};

export function DesignV2Badge() {
  return (
    <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
      Design V2 Active
    </span>
  );
}

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen max-w-[88rem] gap-0 lg:gap-8 lg:px-8 lg:py-8">
        <aside className="hidden w-[17rem] shrink-0 flex-col rounded-xl border border-slate-800/80 bg-slate-950 p-4 md:flex">
          <div className="mb-6 px-2 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-semibold text-white">
                SH
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">LaborLedger</p>
                <h2 className="text-base font-semibold text-white">Admin</h2>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-500">Workforce operations</p>
          </div>
          <AdminNav variant="sidebar" />
          <div className="mt-auto rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-[11px] text-slate-500">
            Version 1 · company ops
          </div>
        </aside>

        <div className="flex min-h-full flex-1 flex-col">
          <header className="border-b border-slate-200/70 bg-white px-5 py-5 lg:mb-6 lg:rounded-xl lg:border lg:shadow-sm lg:shadow-slate-200/40">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Workspace</p>
                  <DesignV2Badge />
                </div>
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                {actions}
                <div className="hidden h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600 sm:flex">
                  A
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-6 lg:rounded-xl lg:border lg:border-slate-200/80 lg:bg-white lg:p-7 lg:shadow-sm lg:shadow-slate-200/30">
            <p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>
            <div className="mt-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
