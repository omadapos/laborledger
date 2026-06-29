import { PlatformShell } from "../../../../../components/platform-shell";

export default function PlatformCustomerCompaniesLoading() {
  return (
    <PlatformShell
      title="Customer companies"
      description="Loading companies for this customer account…"
    >
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading companies…
      </p>
    </PlatformShell>
  );
}
