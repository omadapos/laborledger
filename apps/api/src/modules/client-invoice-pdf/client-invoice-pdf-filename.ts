export function sanitizeInvoicePdfFilename(
  invoiceNumber: string | null,
  clientInvoiceId: string
): string {
  const rawBase = invoiceNumber?.trim()
    ? invoiceNumber.trim().replace(/[^a-zA-Z0-9-]+/gu, "-").replace(/-+/gu, "-").replace(/^-|-$/gu, "")
    : `draft-${clientInvoiceId.slice(0, 8)}`;

  const base = rawBase || `invoice-${clientInvoiceId.slice(0, 8)}`;
  return `invoice-${base}.pdf`;
}
