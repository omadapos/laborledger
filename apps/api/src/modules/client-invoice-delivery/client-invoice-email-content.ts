type InvoiceLineInput = {
  workOrderNumberSnapshot: string;
  vinSnapshot: string;
  vehicleLabelSnapshot: string | null;
  serviceNameSnapshot: string;
  lineTotalMinor: number;
  currencyCode: string;
};

type BuildInvoiceEmailInput = {
  companyName: string;
  serviceClientName: string;
  invoiceNumber: string;
  issuedAt: Date;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currencyCode: string;
  lines: InvoiceLineInput[];
  optionalNote?: string;
  contactPhone?: string | null;
  contactBillingEmail?: string | null;
  contactName?: string | null;
};

function formatMoney(minorUnits: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode
  }).format(minorUnits / 100);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(value);
}

export function buildClientInvoiceEmailSubject(input: Pick<BuildInvoiceEmailInput, "invoiceNumber" | "companyName">) {
  return `Invoice ${input.invoiceNumber} from ${input.companyName}`;
}

export function buildClientInvoiceEmailBodies(input: BuildInvoiceEmailInput) {
  const workOrderNumbers = [...new Set(input.lines.map((line) => line.workOrderNumberSnapshot))];
  const vins = [...new Set(input.lines.map((line) => line.vinSnapshot))];

  const lineSummaries = input.lines.map((line) => {
    const vehicle = line.vehicleLabelSnapshot ?? line.vinSnapshot;
    return `- ${line.workOrderNumberSnapshot} · ${vehicle} · ${line.serviceNameSnapshot}: ${formatMoney(line.lineTotalMinor, line.currencyCode)}`;
  });

  const noteBlock = input.optionalNote?.trim()
    ? `\n\nNote from sender:\n${input.optionalNote.trim()}`
    : "";

  const contactLines = formatInvoiceEmailContactLines(input);
  const contactBlock = contactLines.length > 0 ? `\n\nContact:\n${contactLines.join("\n")}` : "";

  const textBody = [
    `Hello ${input.serviceClientName},`,
    "",
    `${input.companyName} has issued invoice ${input.invoiceNumber} on ${formatDate(input.issuedAt)}.`,
    "",
    `Subtotal: ${formatMoney(input.subtotalMinor, input.currencyCode)}`,
    `Tax: ${formatMoney(input.taxMinor, input.currencyCode)}`,
    `Total: ${formatMoney(input.totalMinor, input.currencyCode)}`,
    "",
    `Work orders: ${workOrderNumbers.join(", ")}`,
    `Vehicle VIN(s): ${vins.join(", ")}`,
    "",
    "Line items:",
    ...lineSummaries,
    contactBlock,
    "",
    "This invoice records completed vehicle services. LaborLedger V1 does not process taxes, payments, payroll, or accounting entries.",
    "View and print this invoice in LaborLedger admin.",
    noteBlock
  ].join("\n");

  const htmlContactBlock =
    contactLines.length > 0
      ? `<p>Contact:<br/>${contactLines.map((line) => escapeHtml(line)).join("<br/>")}</p>`
      : "";

  const htmlBody = [
    `<p>Hello ${escapeHtml(input.serviceClientName)},</p>`,
    `<p><strong>${escapeHtml(input.companyName)}</strong> has issued invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> on ${escapeHtml(formatDate(input.issuedAt))}.</p>`,
    `<p>Subtotal: ${escapeHtml(formatMoney(input.subtotalMinor, input.currencyCode))}<br/>`,
    `Tax: ${escapeHtml(formatMoney(input.taxMinor, input.currencyCode))}<br/>`,
    `<strong>Total: ${escapeHtml(formatMoney(input.totalMinor, input.currencyCode))}</strong></p>`,
    `<p>Work orders: ${escapeHtml(workOrderNumbers.join(", "))}<br/>`,
    `Vehicle VIN(s): ${escapeHtml(vins.join(", "))}</p>`,
    "<p>Line items:</p>",
    "<ul>",
    ...lineSummaries.map((line) => `<li>${escapeHtml(line.replace(/^- /u, ""))}</li>`),
    "</ul>",
    htmlContactBlock,
    "<p><em>This invoice records completed vehicle services. LaborLedger V1 does not process taxes, payments, payroll, or accounting entries.</em></p>",
    "<p>View and print this invoice in LaborLedger admin.</p>",
    input.optionalNote?.trim()
      ? `<p><strong>Note from sender:</strong><br/>${escapeHtml(input.optionalNote.trim())}</p>`
      : ""
  ].join("");

  return { textBody, htmlBody };
}

function formatInvoiceEmailContactLines(
  input: Pick<BuildInvoiceEmailInput, "contactPhone" | "contactBillingEmail" | "contactName">
) {
  const lines: string[] = [];

  if (input.contactPhone?.trim()) {
    lines.push(`Phone: ${input.contactPhone.trim()}`);
  }

  if (input.contactBillingEmail?.trim()) {
    lines.push(`Billing email: ${input.contactBillingEmail.trim()}`);
  }

  if (input.contactName?.trim()) {
    lines.push(`Contact: ${input.contactName.trim()}`);
  }

  return lines;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}
