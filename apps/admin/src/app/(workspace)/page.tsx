import { AdminShell } from "../../components/admin-shell";

const kpis = [
  { label: "Active employees", value: "—", note: "Live data in later slice" },
  { label: "Open shifts today", value: "—", note: "Scheduling slice" },
  { label: "Attendance alerts", value: "0", note: "Timekeeping slice" },
  { label: "Weekly gross pay", value: "—", note: "Gross-pay slice" }
] as const;

export default function DashboardPage() {
  return (
    <AdminShell
      title="Dashboard"
      description="Overview of workforce activity across your companies. KPIs will connect to live API data in upcoming slices."
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">{kpi.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{kpi.value}</p>
            <p className="mt-2 text-xs text-slate-400">{kpi.note}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/30">
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Punch events, approvals, and schedule changes will appear here once timekeeping slices ship.
          </p>
        </section>
        <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-6">
          <h2 className="text-sm font-semibold text-slate-900">Getting started</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>Review employees on the Employees page</li>
            <li>Service Clients and Locations are placeholder shells</li>
            <li>Confirm the &quot;Design V2 Active&quot; badge in the top bar</li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
