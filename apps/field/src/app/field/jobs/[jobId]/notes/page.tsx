import Link from "next/link";
import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { EmployeeJobNotesPagePanel } from "@/components/employee/EmployeeJobNotesPagePanel";
import { readFieldSession } from "@/lib/field-session";

type FieldJobNotesPageProps = {
  readonly params: Promise<{ jobId: string }>;
};

export default async function FieldJobNotesPage({ params }: FieldJobNotesPageProps) {
  const session = await readFieldSession();
  if (!session) {
    redirect("/field/login");
  }

  const { jobId } = await params;

  return (
    <FieldShell title="Notes" subtitle="Optional notes for a service on this job.">
      <div className="space-y-4">
        <EmployeeJobNotesPagePanel assignmentId={jobId} />
        <Link
          href={`/field/jobs/${jobId}`}
          className="inline-flex rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800"
        >
          Back to job
        </Link>
      </div>
    </FieldShell>
  );
}
