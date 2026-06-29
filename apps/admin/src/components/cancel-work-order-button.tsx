"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CancelWorkOrderButtonProps = {
  readonly workOrderId: string;
  readonly workOrderNumber: string;
  readonly isCancelled: boolean;
  readonly onStatusChange?: () => void;
};

export function CancelWorkOrderButton({
  workOrderId,
  workOrderNumber,
  isCancelled,
  onStatusChange
}: CancelWorkOrderButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (isCancelled) {
    return null;
  }

  async function handleConfirm() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const reason = cancelReason.trim();
    if (!reason) {
      setErrorMessage("Cancel reason is required.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/work-orders/${workOrderId}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cancelReason: reason })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to cancel work order.");
      return;
    }

    setSuccessMessage(`${workOrderNumber} was cancelled.`);
    setIsConfirmOpen(false);
    setCancelReason("");
    onStatusChange?.();
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
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
      >
        Cancel work order
      </button>

      {successMessage && !isConfirmOpen ? (
        <p className="text-xs text-emerald-700">{successMessage}</p>
      ) : null}

      {isConfirmOpen ? (
        <div
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          role="dialog"
          aria-labelledby={`cancel-work-order-${workOrderId}`}
        >
          <h3 id={`cancel-work-order-${workOrderId}`} className="text-sm font-semibold text-slate-900">
            Cancel {workOrderNumber}?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Cancelled work orders remain in history but cannot be edited or completed.
          </p>
          <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor={`cancel-reason-${workOrderId}`}>
            Cancel reason
          </label>
          <textarea
            id={`cancel-reason-${workOrderId}`}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            rows={2}
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
              {isSubmitting ? "Saving…" : "Yes, cancel"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Keep work order
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
