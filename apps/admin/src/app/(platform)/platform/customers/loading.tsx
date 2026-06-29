import { PlatformShell } from "../../../../components/platform-shell";
import { platformCustomersPageDescription } from "../../../../lib/platform-customer-utils";

export default function PlatformCustomersLoadingPage() {
  return (
    <PlatformShell title="Customers" description={platformCustomersPageDescription()}>
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Loading customer accounts…
      </p>
    </PlatformShell>
  );
}
