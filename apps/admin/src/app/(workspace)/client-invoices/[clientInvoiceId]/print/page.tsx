import { notFound } from "next/navigation";

import { ClientInvoicePrintActions } from "../../../../../components/client-invoice-print-actions";
import { ClientInvoicePrintView } from "../../../../../components/client-invoice-print-view";
import type { ClientInvoiceListRecord } from "../../../../../lib/client-invoice-utils";
import { apiGet, loadWorkspaceContext } from "../../../../../lib/workspace-auth";

type ClientInvoicePrintPageProps = {
  readonly params: Promise<{
    clientInvoiceId: string;
  }>;
};

export default async function ClientInvoicePrintPage({ params }: ClientInvoicePrintPageProps) {
  const { clientInvoiceId } = await params;
  const workspace = await loadWorkspaceContext();

  if (workspace.blocked || !workspace.selectedCompany) {
    notFound();
  }

  try {
    const invoice = await apiGet<ClientInvoiceListRecord>(
      `/company-operations/client-invoices/${clientInvoiceId}`,
      workspace.cookieHeader
    );

    return (
      <div className="min-h-screen bg-white print:bg-white">
        <ClientInvoicePrintActions />
        <ClientInvoicePrintView invoice={invoice} companyName={workspace.selectedCompany.name} />
      </div>
    );
  } catch {
    notFound();
  }
}
