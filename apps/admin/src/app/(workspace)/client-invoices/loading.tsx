import { AdminShell } from "../../../components/admin-shell";

export default function ClientInvoicesLoading() {
  return (
    <AdminShell
      title="Client Invoices"
      description="Create and issue client invoices from completed vehicle service work orders."
    >
      <div className="animate-pulse space-y-4">
        <div className="h-16 rounded-2xl bg-slate-100" />
        <div className="h-40 rounded-2xl bg-slate-100" />
        <div className="h-64 rounded-2xl bg-slate-100" />
      </div>
    </AdminShell>
  );
}
