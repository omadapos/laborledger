import { AdminShell } from "../../../components/admin-shell";

export default function JobsLoadingPage() {
  return (
    <AdminShell title="Company jobs" description="Loading company jobs…">
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading company jobs…
      </p>
    </AdminShell>
  );
}
