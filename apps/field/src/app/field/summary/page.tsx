import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeHelpCard } from "@/components/employee/EmployeeHelpCard";
import { EmployeeJobWorkflowPanel } from "@/components/employee/EmployeeJobWorkflowPanel";
import { readFieldSession } from "@/lib/field-session";

export default async function FieldSummaryPage() {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  return (
    <FieldShell
      title="Summary"
      subtitle="Review assigned jobs, VIN confirmations, and completed services."
    >
      <div className="space-y-4">
        <EmployeeJobWorkflowPanel summaryOnly />
        <EmployeeHelpCard />
      </div>
    </FieldShell>
  );
}
