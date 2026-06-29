import Link from "next/link";
import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeJobWorkflowPanel } from "@/components/employee/EmployeeJobWorkflowPanel";
import { readFieldSession } from "@/lib/field-session";

type FieldJobDetailPageProps = {
  readonly params: Promise<{ jobId: string }>;
};

export default async function FieldJobDetailPage({ params }: FieldJobDetailPageProps) {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  const { jobId } = await params;

  return (
    <FieldShell
      title="Job"
      subtitle="Confirm VIN, review customer and location, then complete services."
    >
      <div className="space-y-4">
        <EmployeeJobWorkflowPanel initialAssignmentId={jobId} />
        <Link
          href={`/field/jobs/${jobId}/notes`}
          className="inline-flex text-sm font-medium text-brand-700 underline"
        >
          Add notes for a service
        </Link>
      </div>
    </FieldShell>
  );
}
