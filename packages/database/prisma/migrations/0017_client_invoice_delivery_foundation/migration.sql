-- CreateEnum
CREATE TYPE "ClientInvoiceDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "client_invoice_deliveries" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "ClientInvoiceDeliveryStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "messageNote" TEXT,
    "sentAt" TIMESTAMP(3),
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_invoice_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_invoice_deliveries_company_id_idx" ON "client_invoice_deliveries"("companyId");

-- CreateIndex
CREATE INDEX "client_invoice_deliveries_client_invoice_id_idx" ON "client_invoice_deliveries"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "client_invoice_deliveries_recipient_email_idx" ON "client_invoice_deliveries"("recipientEmail");

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "client_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_invoice_deliveries" ADD CONSTRAINT "client_invoice_deliveries_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
