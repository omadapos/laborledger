import { AdminShell } from "../../../../components/admin-shell";

export default function JobDetailLoadingPage() {
  return (
    <AdminShell title="Job detail" description="Loading job details…">
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading job details…
      </p>
    </AdminShell>
  );
}
