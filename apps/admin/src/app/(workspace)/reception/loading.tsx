import { AdminShell } from "../../../components/admin-shell";

export default function ReceptionLoadingPage() {
  return (
    <AdminShell title="Reception" description="Loading reception workspace…">
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading reception workspace…
      </p>
    </AdminShell>
  );
}
