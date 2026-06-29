"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatClientInvoiceNumberLabel, type ClientInvoiceListRecord } from "../lib/client-invoice-utils";

type IssueClientInvoiceButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onIssued?: () => void;
};

export function IssueClientInvoiceButton({ invoice, onIssued }: IssueClientInvoiceButtonProps) {
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (invoice.status !== "DRAFT") {
    return null;
  }

  async function handleIssue() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/client-invoices/${invoice.id}/issue`, {
      method: "POST",
      headers: { "content-type": "application/json" }
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to issue invoice.");
      return;
    }

    setIsConfirmOpen(false);
    onIssued?.();
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
        className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Issue invoice
      </button>

      {isConfirmOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Issue {formatClientInvoiceNumberLabel(invoice)}?
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Issuing freezes invoice lines and totals. This does not record payment or payroll.
          </p>
          {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleIssue}
              disabled={isSubmitting}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Issuing…" : "Yes, issue"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Keep draft
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
