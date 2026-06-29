import { AdminShell } from "../../../components/admin-shell";

export default function ReportsLoadingPage() {
  return (
    <AdminShell
      title="Reports"
      description="Track vehicle service operations, completed work, and client invoice activity."
    >
      <p className="text-sm text-slate-500">Loading operational reports…</p>
    </AdminShell>
  );
}
