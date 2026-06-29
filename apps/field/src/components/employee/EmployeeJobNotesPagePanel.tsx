"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmployeeJobNotesForm } from "@/components/employee/EmployeeJobNotesForm";
import { StatusCard } from "@/components/shared/StatusCard";
import type { FieldJobsContextResponse } from "@/lib/field-jobs-client";
import { findAssignmentById, pendingServiceLines } from "@/lib/field-job-utils";

type EmployeeJobNotesPagePanelProps = {
  readonly assignmentId: string;
};

export function EmployeeJobNotesPagePanel({ assignmentId }: EmployeeJobNotesPagePanelProps) {
  const router = useRouter();
  const [context, setContext] = useState<FieldJobsContextResponse | null>(null);
  const [selectedServiceLineId, setSelectedServiceLineId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadContext = useCallback(async () => {
    setIsLoading(true);
    const response = await fetch("/api/field/jobs/context", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as FieldJobsContextResponse & {
      message?: string;
    };

    if (response.status === 401) {
      router.replace("/field/login");
      return;
    }

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to load job.");
      setIsLoading(false);
      return;
    }

    setContext(payload);
    const assignment = findAssignmentById(payload.assignments, assignmentId);
    const firstPending = assignment ? pendingServiceLines(assignment)[0] : null;
    setSelectedServiceLineId(firstPending?.id ?? assignment?.serviceLines[0]?.id ?? null);
    setIsLoading(false);
  }, [assignmentId, router]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const assignment = useMemo(
    () => findAssignmentById(context?.assignments ?? [], assignmentId),
    [context?.assignments, assignmentId]
  );

  const selectedServiceLine =
    assignment?.serviceLines.find((line) => line.id === selectedServiceLineId) ?? null;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading job…
      </div>
    );
  }

  if (errorMessage) {
    return <StatusCard title="Unable to load job" description={errorMessage} tone="warning" />;
  }

  if (!assignment) {
    return (
      <StatusCard
        title="Job not found"
        description="This job is not in your current assignments."
        tone="warning"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">{assignment.workOrderNumber}</p>
        <p className="mt-1 text-xs text-slate-500">VIN {assignment.vehicle.vin}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="notes-service-line">
          Service
        </label>
        <select
          id="notes-service-line"
          value={selectedServiceLineId ?? ""}
          onChange={(event) => setSelectedServiceLineId(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
        >
          {assignment.serviceLines.map((line) => (
            <option key={line.id} value={line.id}>
              {line.serviceNameSnapshot}
              {line.completion ? " (completed)" : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedServiceLine && !selectedServiceLine.completion ? (
        <EmployeeJobNotesForm
          assignmentId={assignment.assignmentId}
          serviceLineId={selectedServiceLine.id}
          serviceName={selectedServiceLine.serviceNameSnapshot}
          onComplete={() => {
            void loadContext();
          }}
        />
      ) : (
        <StatusCard
          title="Service already complete"
          description="Select a pending service or return to the job to start another."
          tone="neutral"
        />
      )}

      <Link
        href={`/field/jobs/${assignmentId}`}
        className="inline-flex text-sm font-medium text-brand-700 underline"
      >
        Back to job workflow
      </Link>
    </div>
  );
}
