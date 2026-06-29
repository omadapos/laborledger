"use client";

import { useState } from "react";

import {
  formatClientInvoiceDeliverySummary,
  invoiceEmailSendDisabledCopy,
  isValidInvoiceRecipientEmail,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";

type SendClientInvoiceEmailButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
  readonly onSent?: () => void;
};

export function SendClientInvoiceEmailButton({ invoice, onSent }: SendClientInvoiceEmailButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const disabledCopy = invoiceEmailSendDisabledCopy(invoice.status);

  if (disabledCopy) {
    return <p className="text-xs text-slate-500">{disabledCopy}</p>;
  }

  async function handleSubmit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isValidInvoiceRecipientEmail(recipientEmail)) {
      setErrorMessage("Enter a valid recipient email.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/client-invoices/${invoice.id}/send-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipientEmail: recipientEmail.trim(),
        message: message.trim() || undefined
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      recipientEmail?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to send invoice email.");
      onSent?.();
      return;
    }

    setSuccessMessage(`Invoice emailed to ${payload.recipientEmail ?? recipientEmail.trim()}.`);
    setRecipientEmail("");
    setMessage("");
    setIsOpen(false);
    onSent?.();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          setErrorMessage(null);
          setSuccessMessage(null);
        }}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Send invoice by email
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Send invoice by email</h4>
      <p className="mt-1 text-xs text-slate-500">
        Delivery is for the service client recipient. This is not payment collection.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`recipient-${invoice.id}`}>
            Recipient email
          </label>
          <input
            id={`recipient-${invoice.id}`}
            type="email"
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="billing@client.example"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor={`message-${invoice.id}`}>
            Optional note
          </label>
          <textarea
            id={`message-${invoice.id}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
        </div>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Sending…" : "Send email"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {(invoice.deliveries ?? []).length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs text-slate-600">
          {(invoice.deliveries ?? []).slice(0, 5).map((delivery) => (
            <li key={delivery.id}>
              {formatClientInvoiceDeliverySummary(delivery)}
              {delivery.errorMessage ? (
                <span className="mt-0.5 block text-red-600">{delivery.errorMessage}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
