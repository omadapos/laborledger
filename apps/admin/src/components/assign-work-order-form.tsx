"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { assignmentDisclaimer } from "../lib/work-order-utils";
import type { EmployeeRecord } from "../lib/employee-utils";
import type { WorkOrderListRecord } from "../lib/work-order-utils";

type AssignWorkOrderFormProps = {
  readonly workOrder: WorkOrderListRecord;
  readonly employees: EmployeeRecord[];
  readonly onAssigned?: () => void;
};

export function AssignWorkOrderForm({ workOrder, employees, onAssigned }: AssignWorkOrderFormProps) {
  const router = useRouter();
  const activeEmployees = employees.filter((employee) => !employee.archivedAt);
  const [employeeId, setEmployeeId] = useState(workOrder.assignedEmployee?.id ?? "");
  const [workOrderServiceLineId, setWorkOrderServiceLineId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!employeeId) {
      setErrorMessage("Select an employee to assign.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/work-orders/${workOrder.id}/assignments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId,
        ...(workOrderServiceLineId ? { workOrderServiceLineId } : {})
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to assign employee.");
      return;
    }

    setSuccessMessage(
      workOrder.assignedEmployee ? "Employee reassigned successfully." : "Employee assigned successfully."
    );
    onAssigned?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-500">{assignmentDisclaimer()}</p>

      <div>
        <label className="block text-xs font-medium text-slate-600" htmlFor={`assign-employee-${workOrder.id}`}>
          Employee
        </label>
        <select
          id={`assign-employee-${workOrder.id}`}
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          disabled={isSubmitting || activeEmployees.length === 0}
        >
          <option value="">Select employee…</option>
          {activeEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.fullName}
            </option>
          ))}
        </select>
      </div>

      {workOrder.serviceLines.length > 1 ? (
        <div>
          <label
            className="block text-xs font-medium text-slate-600"
            htmlFor={`assign-service-line-${workOrder.id}`}
          >
            Service line (optional)
          </label>
          <select
            id={`assign-service-line-${workOrder.id}`}
            value={workOrderServiceLineId}
            onChange={(event) => setWorkOrderServiceLineId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          >
            <option value="">Whole work order</option>
            {workOrder.serviceLines.map((line) => (
              <option key={line.id} value={line.id}>
                {line.serviceNameSnapshot}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting || activeEmployees.length === 0}
        className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting
          ? "Saving…"
          : workOrder.assignedEmployee
            ? "Reassign employee"
            : "Assign employee"}
      </button>
    </form>
  );
}
