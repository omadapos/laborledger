"use client";

import { useState } from "react";

import {
  buildClientInvoicePdfPath,
  clientInvoicePdfButtonLabel,
  type ClientInvoiceListRecord
} from "../lib/client-invoice-utils";

type DownloadInvoicePdfButtonProps = {
  readonly invoice: ClientInvoiceListRecord;
};

export function DownloadInvoicePdfButton({ invoice }: DownloadInvoicePdfButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload() {
    setIsDownloading(true);
    setErrorMessage(null);

    const response = await fetch(buildClientInvoicePdfPath(invoice.id));

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setErrorMessage(payload.message ?? "Unable to download invoice PDF.");
      setIsDownloading(false);
      return;
    }

    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const filenameMatch = disposition.match(/filename="([^"]+)"/u);
    const filename = filenameMatch?.[1] ?? "invoice.pdf";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setIsDownloading(false);
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={isDownloading}
        className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {isDownloading ? "Preparing PDF…" : clientInvoicePdfButtonLabel(invoice.status)}
      </button>
      <p className="text-xs text-slate-500">Email sending is configured by platform environment.</p>
      {errorMessage ? <p className="text-xs text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
