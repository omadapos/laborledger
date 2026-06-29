"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { type WorkOrderListRecord, type WorkOrderStatus } from "../lib/work-order-utils";

type EditWorkOrderFormProps = {
  readonly workOrder: WorkOrderListRecord;
  readonly onSaved?: () => void;
};

export function EditWorkOrderForm({ workOrder, onSaved }: EditWorkOrderFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(workOrder.notes ?? "");
  const [status, setStatus] = useState<WorkOrderStatus>(workOrder.status);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCancelled = workOrder.status === "CANCELLED";
  const isCompleted = workOrder.status === "COMPLETED";
  const isInvoiced = workOrder.status === "INVOICED";
  const canMarkReady = workOrder.status === "DRAFT";

  function resetFields() {
    setNotes(workOrder.notes ?? "");
    setStatus(workOrder.status);
    setSubmitError(null);
  }

  function handleCancel() {
    resetFields();
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/work-orders/${workOrder.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notes: notes.trim() || null,
        ...(canMarkReady && status === "READY" ? { status: "READY" as const } : {})
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update work order.");
      return;
    }

    setSuccessMessage("Work order was updated.");
    setIsEditing(false);
    onSaved?.();
    router.refresh();
  }

  if (isCancelled || isCompleted || isInvoiced) {
    return null;
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          resetFields();
          setSuccessMessage(null);
          setIsEditing(true);
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      {canMarkReady ? (
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-work-order-status-${workOrder.id}`}>
            Status
          </label>
          <select
            id={`edit-work-order-status-${workOrder.id}`}
            value={status}
            onChange={(event) => setStatus(event.target.value as WorkOrderStatus)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          >
            <option value="DRAFT">Draft</option>
            <option value="READY">Ready</option>
          </select>
        </div>
      ) : null}

      <div>
        <label className="block text-xs font-medium text-slate-600" htmlFor={`edit-work-order-notes-${workOrder.id}`}>
          Notes
        </label>
        <textarea
          id={`edit-work-order-notes-${workOrder.id}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
          disabled={isSubmitting}
        />
      </div>

      {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
