import { AdminShell } from "../../../components/admin-shell";

export default function CorrectionsLoading() {
  return (
    <AdminShell title="Corrections" description="Review requested changes to punch events while preserving original records and audit history.">
      <div className="animate-pulse space-y-4">
        <div className="h-32 rounded-xl bg-slate-100" />
        <div className="h-64 rounded-xl bg-slate-100" />
      </div>
    </AdminShell>
  );
}
