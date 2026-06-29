"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ArchiveServiceClientButtonProps = {
  readonly serviceClientId: string;
  readonly serviceClientName: string;
  readonly isArchived: boolean;
  readonly onStatusChange?: () => void;
};

export function ArchiveServiceClientButton({
  serviceClientId,
  serviceClientName,
  isArchived,
  onStatusChange
}: ArchiveServiceClientButtonProps) {
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
      ? `/api/company-operations/service-clients/${serviceClientId}/unarchive`
      : `/api/company-operations/service-clients/${serviceClientId}/archive`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" }
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to update service client status.");
      return;
    }

    setSuccessMessage(isArchived ? `${serviceClientName} is active again.` : `${serviceClientName} was deactivated.`);
    setIsConfirmOpen(false);
    onStatusChange?.();
    router.refresh();
  }

  const actionLabel = isArchived ? "Reactivate" : "Deactivate";
  const confirmTitle = isArchived ? "Reactivate service client?" : "Deactivate service client?";
  const confirmBody = isArchived
    ? `${serviceClientName} will appear in active lists again and can be assigned to new locations.`
    : `${serviceClientName} will be hidden from active lists. Existing locations and historical data are preserved.`;

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
          aria-labelledby={`archive-service-client-${serviceClientId}`}
        >
          <h3 id={`archive-service-client-${serviceClientId}`} className="text-sm font-semibold text-slate-900">
            {confirmTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{confirmBody}</p>
          {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving…" : `Yes, ${actionLabel.toLowerCase()}`}
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
