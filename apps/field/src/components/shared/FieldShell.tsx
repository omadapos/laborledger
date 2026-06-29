import Link from "next/link";
import type { ReactNode } from "react";

type FieldShellProps = {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly showHomeLink?: boolean;
};

export function FieldShell({ title, subtitle, children, showHomeLink = true }: FieldShellProps) {
  return (
    <div className="min-h-screen pt-[max(0px,env(safe-area-inset-top))]">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              LaborLedger Field
            </p>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          {showHomeLink ? (
            <Link
              href="/field/home"
              className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Home
            </Link>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
