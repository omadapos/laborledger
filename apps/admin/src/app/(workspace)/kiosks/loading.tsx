import { AdminShell } from "../../../components/admin-shell";

export default function KiosksLoadingPage() {
  return (
    <AdminShell
      title="Kiosks"
      description="Loading kiosks from the API..."
    >
      <div className="space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="h-4 w-64 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-10 max-w-md animate-pulse rounded-lg bg-slate-200" />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="space-y-0 divide-y divide-slate-100">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-5 py-4">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
