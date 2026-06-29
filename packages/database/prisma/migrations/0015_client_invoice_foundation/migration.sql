-- CreateEnum
CREATE TYPE "ClientInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'VOID');

-- AlterEnum
ALTER TYPE "WorkOrderStatus" ADD VALUE 'INVOICED';

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN "invoicedClientInvoiceId" TEXT;

-- CreateTable
CREATE TABLE "client_invoices" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "status" "ClientInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoice_lines" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderServiceLineId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "workOrderNumberSnapshot" TEXT NOT NULL,
    "vinSnapshot" TEXT NOT NULL,
    "vehicleLabelSnapshot" TEXT,
    "serviceNameSnapshot" TEXT NOT NULL,
    "serviceCategorySnapshot" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceMinor" INTEGER NOT NULL,
    "lineTotalMinor" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_invoices_group_id_idx" ON "client_invoices"("groupId");

-- CreateIndex
CREATE INDEX "client_invoices_company_id_idx" ON "client_invoices"("companyId");

-- CreateIndex
CREATE INDEX "client_invoices_service_client_id_idx" ON "client_invoices"("serviceClientId");

-- CreateIndex
CREATE INDEX "client_invoices_company_id_status_idx" ON "client_invoices"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "client_invoices_company_id_invoice_number_key" ON "client_invoices"("companyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "client_invoice_lines_company_id_idx" ON "client_invoice_lines"("companyId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_client_invoice_id_idx" ON "client_invoice_lines"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_work_order_id_idx" ON "client_invoice_lines"("workOrderId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_work_order_service_line_id_idx" ON "client_invoice_lines"("workOrderServiceLineId");

-- CreateIndex
CREATE INDEX "client_invoice_lines_vehicle_id_idx" ON "client_invoice_lines"("vehicleId");

-- CreateIndex
CREATE INDEX "work_orders_invoiced_client_invoice_id_idx" ON "work_orders"("invoicedClientInvoiceId");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_invoicedClientInvoiceId_fkey" FOREIGN KEY ("invoicedClientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoices" ADD CONSTRAINT "client_invoices_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_workOrderServiceLineId_fkey" FOREIGN KEY ("workOrderServiceLineId") REFERENCES "work_order_service_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_lines" ADD CONSTRAINT "client_invoice_lines_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
