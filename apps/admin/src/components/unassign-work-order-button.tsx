"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UnassignWorkOrderButtonProps = {
  readonly assignmentId: string;
  readonly employeeName: string;
  readonly onUnassigned?: () => void;
};

export function UnassignWorkOrderButton({
  assignmentId,
  employeeName,
  onUnassigned
}: UnassignWorkOrderButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [unassignReason, setUnassignReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch(
      `/api/company-operations/work-order-assignments/${assignmentId}/unassign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(unassignReason.trim() ? { unassignReason: unassignReason.trim() } : {})
        })
      }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to unassign employee.");
      return;
    }

    setIsConfirmOpen(false);
    setUnassignReason("");
    onUnassigned?.();
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setErrorMessage(null);
          setIsConfirmOpen(true);
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Unassign {employeeName}
      </button>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">Remove assignment for {employeeName}?</p>
          <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor={`unassign-reason-${assignmentId}`}>
            Reason (optional)
          </label>
          <input
            id={`unassign-reason-${assignmentId}`}
            value={unassignReason}
            onChange={(event) => setUnassignReason(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
          {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving…" : "Yes, unassign"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
