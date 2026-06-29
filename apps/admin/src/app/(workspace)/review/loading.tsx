import { AdminShell } from "../../../components/admin-shell";

export default function ReviewLoading() {
  return (
    <AdminShell
      title="Review"
      description="Review completed shifts, exceptions, breaks, and internal labor estimates before approval."
    >
      <div className="animate-pulse space-y-4">
        <div className="h-14 rounded-xl bg-slate-100" />
        <div className="h-32 rounded-xl bg-slate-100" />
        <div className="h-64 rounded-xl bg-slate-100" />
      </div>
    </AdminShell>
  );
}
