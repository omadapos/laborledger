import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { EmployeeJobsHubPanel } from "@/components/employee/EmployeeJobsHubPanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldJobsNewPage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="Start job"
      subtitle="Create a new job or complete a supervisor-assigned job."
    >
      <div className="space-y-4">
        <EmployeeJobsHubPanel />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
