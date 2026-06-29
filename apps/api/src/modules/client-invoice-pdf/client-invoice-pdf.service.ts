import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ClientInvoiceStatus } from "@prisma/client";
import PDFDocument from "pdfkit";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";
import { sanitizeInvoicePdfFilename } from "./client-invoice-pdf-filename";
import {
  CLIENT_INVOICE_PDF_DISCLAIMER,
  formatPdfDate,
  formatPdfInvoiceNumberLabel,
  formatPdfLineSummary,
  formatPdfMoney,
  formatPdfStatusLabel
} from "./client-invoice-pdf-format";
import {
  buildCompanyProfileHeaderLines,
  type CompanyProfileSource
} from "../company-operations/company-profile-display";

export type ClientInvoicePdfResult = {
  buffer: Buffer;
  filename: string;
};

type InvoicePdfSource = {
  id: string;
  invoiceNumber: string | null;
  status: ClientInvoiceStatus;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currencyCode: string;
  notes: string | null;
  createdAt: Date;
  issuedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  serviceClient: { name: string };
  issuedByUser: { fullName: string | null } | null;
  voidedByUser: { fullName: string | null } | null;
  lines: Array<{
    serviceNameSnapshot: string;
    workOrderNumberSnapshot: string;
    vinSnapshot: string;
    vehicleLabelSnapshot: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    currencyCode: string;
  }>;
};

@Injectable()
export class ClientInvoicePdfService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async generateClientInvoicePdf(
    principal: AuthenticatedPrincipal,
    clientInvoiceId: string
  ): Promise<ClientInvoicePdfResult> {
    const { invoice, companyProfile } = await this.loadInvoiceForPdf(principal, clientInvoiceId);
    return this.renderInvoicePdf(invoice, companyProfile);
  }

  async generateClientInvoicePdfForDelivery(
    invoice: InvoicePdfSource & { companyId: string },
    companyProfile: CompanyProfileSource
  ): Promise<ClientInvoicePdfResult> {
    return this.renderInvoicePdf(invoice, companyProfile);
  }

  private async loadInvoiceForPdf(principal: AuthenticatedPrincipal, clientInvoiceId: string) {
    const invoice = await this.prisma.clientInvoice.findUnique({
      where: { id: clientInvoiceId },
      include: {
        serviceClient: { select: { name: true } },
        issuedByUser: { select: { fullName: true } },
        voidedByUser: { select: { fullName: true } },
        lines: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!invoice) {
      throw new NotFoundException("Client invoice not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, invoice.companyId);

    const company = await this.prisma.company.findUnique({
      where: { id: invoice.companyId },
      select: {
        name: true,
        legalName: true,
        phone: true,
        billingEmail: true,
        primaryContactName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        stateRegion: true,
        postalCode: true,
        country: true
      }
    });

    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    return { invoice, companyProfile: company };
  }

  private async renderInvoicePdf(
    invoice: InvoicePdfSource,
    companyProfile: CompanyProfileSource
  ): Promise<ClientInvoicePdfResult> {
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      this.drawStatusWatermark(doc, invoice.status);

      doc.fontSize(10).fillColor("#64748b").text("LaborLedger invoice", { align: "left" });
      doc.moveDown(0.5);
      doc.fontSize(20).fillColor("#0f172a").text(formatPdfInvoiceNumberLabel(invoice.invoiceNumber, invoice.id));

      const headerLines = buildCompanyProfileHeaderLines(companyProfile);
      headerLines.forEach((line, index) => {
        doc
          .fontSize(index === 0 ? 12 : 11)
          .fillColor(index === 0 ? "#334155" : "#475569")
          .text(line);
      });

      doc.moveDown(0.5);
      doc
        .fontSize(11)
        .fillColor("#475569")
        .text(`Status: ${formatPdfStatusLabel(invoice.status)} · Created ${formatPdfDate(invoice.createdAt)}`);

      doc.moveDown(1.5);
      doc.fontSize(10).fillColor("#64748b").text("Bill to");
      doc.fontSize(12).fillColor("#0f172a").text(invoice.serviceClient.name);

      doc.moveDown(1);
      doc.fontSize(10).fillColor("#64748b").text("Issue details");
      doc
        .fontSize(11)
        .fillColor("#334155")
        .text(
          invoice.issuedAt
            ? `Issued ${formatPdfDate(invoice.issuedAt)}${invoice.issuedByUser?.fullName ? ` · ${invoice.issuedByUser.fullName}` : ""}`
            : "Not issued"
        );

      if (invoice.voidedAt) {
        doc.text(
          `Voided ${formatPdfDate(invoice.voidedAt)}${invoice.voidReason ? ` · ${invoice.voidReason}` : ""}`
        );
      }

      doc.moveDown(1.5);
      doc.fontSize(10).fillColor("#64748b").text("Line items");
      doc.moveDown(0.5);

      const tableTop = doc.y;
      doc.fontSize(9).fillColor("#64748b");
      doc.text("Service", 50, tableTop, { width: 150 });
      doc.text("Work order / vehicle", 210, tableTop, { width: 180 });
      doc.text("Qty", 400, tableTop, { width: 40 });
      doc.text("Unit", 440, tableTop, { width: 60, align: "right" });
      doc.text("Amount", 510, tableTop, { width: 52, align: "right" });

      let rowY = tableTop + 16;
      doc.fontSize(10).fillColor("#0f172a");

      for (const line of invoice.lines) {
        if (rowY > 680) {
          doc.addPage();
          this.drawStatusWatermark(doc, invoice.status);
          rowY = 50;
        }

        doc.text(line.serviceNameSnapshot, 50, rowY, { width: 150 });
        doc.text(formatPdfLineSummary(line), 210, rowY, { width: 180 });
        doc.text(String(line.quantity), 400, rowY, { width: 40 });
        doc.text(formatPdfMoney(line.unitPriceMinor, line.currencyCode), 440, rowY, {
          width: 60,
          align: "right"
        });
        doc.text(formatPdfMoney(line.lineTotalMinor, line.currencyCode), 510, rowY, {
          width: 52,
          align: "right"
        });
        doc.fontSize(8).fillColor("#64748b").text(`VIN: ${line.vinSnapshot}`, 210, rowY + 12, { width: 180 });
        doc.fontSize(10).fillColor("#0f172a");
        rowY += 32;
      }

      doc.moveDown(2);
      const totalsX = 400;
      doc.text(`Subtotal: ${formatPdfMoney(invoice.subtotalMinor, invoice.currencyCode)}`, totalsX, doc.y, {
        align: "right"
      });
      doc.text(`Tax: ${formatPdfMoney(invoice.taxMinor, invoice.currencyCode)}`, totalsX, doc.y + 14, {
        align: "right"
      });
      doc
        .fontSize(12)
        .fillColor("#0f172a")
        .text(`Total: ${formatPdfMoney(invoice.totalMinor, invoice.currencyCode)}`, totalsX, doc.y + 28, {
          align: "right"
        });

      if (invoice.notes?.trim()) {
        doc.moveDown(2);
        doc.fontSize(10).fillColor("#64748b").text("Notes");
        doc.fontSize(11).fillColor("#334155").text(invoice.notes.trim());
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor("#64748b").text(CLIENT_INVOICE_PDF_DISCLAIMER, {
        align: "left"
      });

      doc.end();
    });

    return {
      buffer,
      filename: sanitizeInvoicePdfFilename(invoice.invoiceNumber, invoice.id)
    };
  }

  private drawStatusWatermark(doc: InstanceType<typeof PDFDocument>, status: ClientInvoiceStatus) {
    if (status !== ClientInvoiceStatus.DRAFT && status !== ClientInvoiceStatus.VOID) {
      return;
    }

    const label = status === ClientInvoiceStatus.DRAFT ? "DRAFT" : "VOID";

    doc.save();
    doc.rotate(-35, { origin: [306, 396] });
    doc.fontSize(72).fillColor("#e2e8f0").text(label, 120, 320, {
      width: 400,
      align: "center"
    });
    doc.restore();
    doc.fillColor("#0f172a");
  }
}
