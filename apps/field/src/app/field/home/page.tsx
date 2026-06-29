import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { FieldHomePanel } from "@/components/employee/FieldHomePanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldHomePage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="Home"
      subtitle="Manage your shift, start a job, or review your summary."
      showHomeLink={false}
    >
      <div className="space-y-4">
        <FieldHomePanel />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
