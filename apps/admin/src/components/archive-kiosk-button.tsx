"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ArchiveKioskButtonProps = {
  readonly kioskId: string;
  readonly kioskName: string;
  readonly isArchived: boolean;
  readonly onStatusChange?: () => void;
};

export function ArchiveKioskButton({
  kioskId,
  kioskName,
  isArchived,
  onStatusChange
}: ArchiveKioskButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const endpoint = isArchived
      ? `/api/company-operations/kiosks/${kioskId}/unarchive`
      : `/api/company-operations/kiosks/${kioskId}/archive`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" }
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to update kiosk status.");
      return;
    }

    setSuccessMessage(isArchived ? `${kioskName} is active again.` : `${kioskName} was deactivated.`);
    setIsConfirmOpen(false);
    onStatusChange?.();
    router.refresh();
  }

  const actionLabel = isArchived ? "Reactivate" : "Deactivate";
  const confirmTitle = isArchived ? "Reactivate kiosk?" : "Deactivate kiosk?";
  const confirmBody = isArchived
    ? `${kioskName} can authenticate again after reactivation. Update the kiosk device if credentials changed while inactive.`
    : `${kioskName} will stop accepting punch requests until reactivated. Historical punch data is preserved.`;

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
        {actionLabel}
      </button>

      {successMessage && !isConfirmOpen ? (
        <p className="text-xs text-emerald-700">{successMessage}</p>
      ) : null}

      {isConfirmOpen ? (
        <div
          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          role="dialog"
          aria-labelledby={`archive-kiosk-${kioskId}`}
        >
          <h4 id={`archive-kiosk-${kioskId}`} className="text-sm font-semibold text-slate-900">
            {confirmTitle}
          </h4>
          <p className="mt-1 text-sm text-slate-600">{confirmBody}</p>
          {errorMessage ? <p className="mt-2 text-xs text-red-600">{errorMessage}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Updating…" : actionLabel}
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
