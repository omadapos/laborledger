import { ClientInvoiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { sanitizeInvoicePdfFilename } from "../src/modules/client-invoice-pdf/client-invoice-pdf-filename";
import {
  CLIENT_INVOICE_PDF_DISCLAIMER,
  formatPdfInvoiceNumberLabel,
  formatPdfMoney,
  formatPdfStatusLabel
} from "../src/modules/client-invoice-pdf/client-invoice-pdf-format";
import { summarizeEmailAttachments } from "../src/modules/email/email-attachment-utils";

describe("PDF02 invoice PDF utilities", () => {
  it("sanitizes invoice PDF filenames", () => {
    expect(sanitizeInvoicePdfFilename("INV-20260622-0001", "clinv_123")).toBe(
      "invoice-INV-20260622-0001.pdf"
    );
    expect(sanitizeInvoicePdfFilename("INV/2026 0001", "clinv_123")).toBe("invoice-INV-2026-0001.pdf");
    expect(sanitizeInvoicePdfFilename(null, "clinv_abcdefghij")).toBe("invoice-draft-clinv_ab.pdf");
  });

  it("formats invoice labels and money for PDF output", () => {
    expect(formatPdfMoney(9900, "USD")).toBe("$99.00");
    expect(formatPdfStatusLabel(ClientInvoiceStatus.DRAFT)).toBe("Draft");
    expect(formatPdfStatusLabel(ClientInvoiceStatus.VOID)).toBe("Void");
    expect(formatPdfInvoiceNumberLabel(null, "clinv_abcdefghij")).toBe("Draft clinv_ab");
    expect(CLIENT_INVOICE_PDF_DISCLAIMER).toContain("does not process payments");
  });

  it("summarizes email attachments without content payloads", () => {
    const summary = summarizeEmailAttachments([
      {
        filename: "invoice-INV-1.pdf",
        contentType: "application/pdf",
        content: Buffer.from("%PDF-1.4 test")
      }
    ]);

    expect(summary).toEqual([
      {
        filename: "invoice-INV-1.pdf",
        contentType: "application/pdf",
        size: Buffer.from("%PDF-1.4 test").length
      }
    ]);
  });
});
