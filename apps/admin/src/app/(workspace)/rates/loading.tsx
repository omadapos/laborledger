import { AdminShell } from "../../../components/admin-shell";

export default function RatesLoadingPage() {
  return (
    <AdminShell
      title="Rates"
      description="Loading rate estimates from the API..."
    >
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-amber-50" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
