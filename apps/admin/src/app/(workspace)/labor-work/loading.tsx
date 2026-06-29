import { AdminShell } from "../../../components/admin-shell";

export default function LaborWorkLoadingPage() {
  return (
    <AdminShell
      title="Labor Work Log"
      description="Review operational work assignments linked to approved clock/punch hours."
    >
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading labor work log…
      </p>
    </AdminShell>
  );
}
