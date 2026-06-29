"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatClientInvoiceNumberLabel, type ClientInvoiceListRecord } from "../lib/client-invoice-utils";

type VoidClientInvoiceButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onVoided?: () => void;
};

export function VoidClientInvoiceButton({ invoice, onVoided }: VoidClientInvoiceButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (invoice.status !== "ISSUED") {
    return null;
  }

  async function handleVoid() {
    const reason = voidReason.trim();
    if (!reason) {
      setErrorMessage("Void reason is required.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/client-invoices/${invoice.id}/void`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voidReason: reason })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to void invoice.");
      return;
    }

    setIsConfirmOpen(false);
    setVoidReason("");
    onVoided?.();
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
        Void invoice
      </button>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Void {formatClientInvoiceNumberLabel(invoice)}?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Voiding keeps the invoice record for audit and releases linked work orders for future invoicing.
          </p>
          <label className="mt-3 block text-xs font-medium text-slate-600" htmlFor={`void-reason-${invoice.id}`}>
            Void reason
          </label>
          <textarea
            id={`void-reason-${invoice.id}`}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            disabled={isSubmitting}
          />
          {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleVoid}
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving…" : "Yes, void"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Keep issued
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
