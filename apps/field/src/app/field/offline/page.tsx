import Link from "next/link";

import { FieldShell } from "@/components/shared/FieldShell";
import { StatusCard } from "@/components/shared/StatusCard";

export default function FieldOfflinePage() {
  return (
    <FieldShell title="Offline" subtitle="Online-first Field PWA — queue sync is a future slice.">
      <div className="space-y-4">
        <StatusCard
          title="No offline queue yet"
          description="Punch, scan, and completion require network connectivity. The offline banner blocks submit when the browser reports offline."
          tone="warning"
        />
        <Link
          href="/field/select-mode"
          className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
        >
          Back to mode selector
        </Link>
      </div>
    </FieldShell>
  );
}
