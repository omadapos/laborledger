import { AdminShell } from "../../../components/admin-shell";

export default function SettingsLoadingPage() {
  return (
    <AdminShell title="Company settings" description="Loading company profile…">
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading company profile…
      </p>
    </AdminShell>
  );
}
