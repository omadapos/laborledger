"use client";

import { useState } from "react";

import { EmployeeCreateJobPanel } from "@/components/employee/EmployeeCreateJobPanel";
import { EmployeeJobWorkflowPanel } from "@/components/employee/EmployeeJobWorkflowPanel";

type JobHubMode = "create" | "assigned";

type EmployeeJobsHubPanelProps = {
  readonly initialAssignmentId?: string | null;
};

export function EmployeeJobsHubPanel({ initialAssignmentId = null }: EmployeeJobsHubPanelProps) {
  const [mode, setMode] = useState<JobHubMode>(initialAssignmentId ? "assigned" : "create");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            mode === "create"
              ? "bg-brand-600 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Create new job
        </button>
        <button
          type="button"
          onClick={() => setMode("assigned")}
          className={`rounded-xl px-3 py-3 text-sm font-semibold ${
            mode === "assigned"
              ? "bg-brand-600 text-white"
              : "bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Assigned jobs
        </button>
      </div>

      {mode === "create" ? (
        <EmployeeCreateJobPanel />
      ) : (
        <EmployeeJobWorkflowPanel initialAssignmentId={initialAssignmentId} />
      )}
    </div>
  );
}
