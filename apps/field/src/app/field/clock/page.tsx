import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { FieldClockPanel } from "@/components/employee/FieldClockPanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldClockPage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell title="Clock" subtitle="Clock in, take breaks, and clock out for your shift.">
      <div className="space-y-4">
        <FieldClockPanel />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
