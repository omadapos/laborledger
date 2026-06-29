import { AdminShell } from "../../../components/admin-shell";

export default function LaborBillingLoadingPage() {
  return (
    <AdminShell
      title="Labor Pay & Billing"
      description="Review approved labor hours for employee pay prep and client labor billing in one place."
    >
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        Loading labor pay and billing preview…
      </p>
    </AdminShell>
  );
}
