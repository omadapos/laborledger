"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  clientInvoiceDisclaimer,
  formatClientInvoiceMoney,
  sumSelectedWorkOrderTotals,
  type CompanyRecord,
  type InvoiceableWorkOrderRecord,
  type ServiceClientRecord
} from "../lib/client-invoice-utils";
import { formatWorkOrderVehicleSummary } from "../lib/work-order-utils";
import type { VehicleListRecord } from "../lib/vehicle-utils";

type CreateClientInvoiceFormProps = {
  readonly company: CompanyRecord;
  readonly serviceClients: ServiceClientRecord[];
};

export function CreateClientInvoiceForm({ company, serviceClients }: CreateClientInvoiceFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [serviceClientId, setServiceClientId] = useState("");
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);
  const [invoiceableWorkOrders, setInvoiceableWorkOrders] = useState<InvoiceableWorkOrderRecord[]>([]);
  const [notes, setNotes] = useState("");
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeClients = serviceClients.filter((client) => !client.archivedAt);

  const selectedWorkOrders = useMemo(
    () => invoiceableWorkOrders.filter((workOrder) => selectedWorkOrderIds.includes(workOrder.id)),
    [invoiceableWorkOrders, selectedWorkOrderIds]
  );

  const draftTotalMinor = sumSelectedWorkOrderTotals(selectedWorkOrders);
  const currencyCode = selectedWorkOrders[0]?.currencyCode ?? "USD";

  useEffect(() => {
    if (!isOpen || !serviceClientId) {
      setInvoiceableWorkOrders([]);
      setSelectedWorkOrderIds([]);
      return;
    }

    let cancelled = false;
    setIsLoadingWorkOrders(true);
    setErrorMessage(null);

    fetch(
      `/api/company-operations/companies/${company.id}/invoiceable-work-orders?serviceClientId=${encodeURIComponent(serviceClientId)}`
    )
      .then(async (response) => {
        const payload = (await response.json().catch(() => [])) as InvoiceableWorkOrderRecord[] | { message?: string };
        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setInvoiceableWorkOrders([]);
          setErrorMessage(
            Array.isArray(payload) ? "Unable to load invoiceable work orders." : (payload.message ?? "Unable to load invoiceable work orders.")
          );
          return;
        }

        setInvoiceableWorkOrders(Array.isArray(payload) ? payload : []);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingWorkOrders(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company.id, isOpen, serviceClientId]);

  function toggleWorkOrder(workOrderId: string) {
    setSelectedWorkOrderIds((current) =>
      current.includes(workOrderId)
        ? current.filter((id) => id !== workOrderId)
        : [...current, workOrderId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!serviceClientId) {
      setErrorMessage("Service client is required.");
      return;
    }

    if (selectedWorkOrderIds.length === 0) {
      setErrorMessage("Select at least one completed work order.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${company.id}/client-invoices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceClientId,
        workOrderIds: selectedWorkOrderIds,
        notes: notes.trim() || undefined
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to create draft invoice.");
      return;
    }

    setIsOpen(false);
    setServiceClientId("");
    setSelectedWorkOrderIds([]);
    setNotes("");
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Create draft invoice
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <h2 className="text-lg font-semibold text-slate-900">Create draft invoice</h2>
      <p className="mt-1 text-sm text-slate-600">{clientInvoiceDisclaimer()}</p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="invoice-service-client">
            Service client
          </label>
          <select
            id="invoice-service-client"
            value={serviceClientId}
            onChange={(event) => {
              setServiceClientId(event.target.value);
              setSelectedWorkOrderIds([]);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            disabled={isSubmitting}
          >
            <option value="">Select client</option>
            {activeClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {serviceClientId ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-400">
              Completed uninvoiced work orders
            </p>
            {isLoadingWorkOrders ? (
              <p className="mt-3 text-sm text-slate-500">Loading invoiceable work orders…</p>
            ) : invoiceableWorkOrders.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                No completed uninvoiced work orders for this client.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {invoiceableWorkOrders.map((workOrder) => {
                  const checked = selectedWorkOrderIds.includes(workOrder.id);
                  const vehicleSummary = formatWorkOrderVehicleSummary(workOrder.vehicle as VehicleListRecord);

                  return (
                    <li key={workOrder.id}>
                      <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 px-4 py-3 hover:border-slate-300">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleWorkOrder(workOrder.id)}
                          className="mt-1"
                          disabled={isSubmitting}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-900">
                            {workOrder.workOrderNumber} · {vehicleSummary}
                          </span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {workOrder.serviceLineCount} service
                            {workOrder.serviceLineCount === 1 ? "" : "s"} ·{" "}
                            {formatClientInvoiceMoney(workOrder.totalServiceAmountMinor, workOrder.currencyCode)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        <div>
          <label className="block text-xs font-medium text-slate-600" htmlFor="invoice-notes">
            Notes (optional)
          </label>
          <textarea
            id="invoice-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
        </div>

        {selectedWorkOrders.length > 0 ? (
          <p className="text-sm font-medium text-slate-900">
            Draft subtotal: {formatClientInvoiceMoney(draftTotalMinor, currencyCode)} (tax excluded)
          </p>
        ) : null}

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting || selectedWorkOrderIds.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Creating…" : "Create draft"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setErrorMessage(null);
            }}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
