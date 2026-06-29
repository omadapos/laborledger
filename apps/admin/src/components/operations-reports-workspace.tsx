"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CompanyRecord } from "../lib/employee-utils";
import {
  formatInvoiceStatusLabel,
  formatOperationsReportMoney,
  formatWorkOrderStatusSummaryLabel,
  hasOperationsReportActivity,
  OPERATIONS_REPORTS_DISCLAIMER,
  operationsReportsEmptyMessage,
  type OperationsReportDateRangeQuery,
  type OperationsSummaryReport
} from "../lib/operations-reports-utils";

type OperationsReportsWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly report: OperationsSummaryReport;
  readonly initialRange: OperationsReportDateRangeQuery;
};

const KPI_CARDS = [
  { key: "completedVehicles", label: "Vehicles processed" },
  { key: "completedWorkOrders", label: "Work orders completed" },
  { key: "completedServiceLines", label: "Services completed" },
  { key: "issuedInvoiceCount", label: "Invoices issued" },
  { key: "voidInvoiceCount", label: "Invoices voided" },
  { key: "pendingWorkOrderCount", label: "Pending work orders" },
  { key: "inProgressWorkOrderCount", label: "In-progress work orders" },
  { key: "uninvoicedCompletedWorkOrderCount", label: "Uninvoiced completed work" }
] as const;

export function OperationsReportsWorkspace({
  companies,
  selectedCompany,
  report,
  initialRange
}: OperationsReportsWorkspaceProps) {
  const router = useRouter();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const showEmptyState = !hasOperationsReportActivity(report);

  function applyRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRangeError(null);

    if (!from || !to) {
      setRangeError("Both from and to dates are required.");
      return;
    }

    if (from > to) {
      setRangeError("From date must be on or before to date.");
      return;
    }

    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    if (companies.length > 1) {
      params.set("companyId", selectedCompany.id);
    }

    router.push(`/reports?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {OPERATIONS_REPORTS_DISCLAIMER}
      </p>

      <form
        onSubmit={applyRange}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Date range</h2>
            <p className="mt-1 text-xs text-slate-500">{report.dateRange.timezoneNote}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">To</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Apply range
            </button>
          </div>
        </div>
        {rangeError ? <p className="mt-3 text-sm text-red-600">{rangeError}</p> : null}
      </form>

      {showEmptyState ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          <p className="font-medium text-slate-900">{operationsReportsEmptyMessage(true).title}</p>
          <p className="mt-2">{operationsReportsEmptyMessage(true).description}</p>
        </div>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-slate-900">Operational KPIs</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {KPI_CARDS.map((card) => (
            <article
              key={card.key}
              className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30"
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {report.kpis[card.key]}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h2 className="text-sm font-semibold text-slate-900">Revenue summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Issued in range</dt>
              <dd className="font-medium text-slate-900">
                {formatOperationsReportMoney(report.revenue.invoicedRevenueMinor, report.currencyCode)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500">Voided in range</dt>
              <dd className="font-medium text-slate-900">
                {formatOperationsReportMoney(report.revenue.voidedRevenueMinor, report.currencyCode)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <dt className="font-medium text-slate-700">Net issued revenue</dt>
              <dd className="text-base font-semibold text-slate-900">
                {formatOperationsReportMoney(report.revenue.netIssuedRevenueMinor, report.currencyCode)}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h2 className="text-sm font-semibold text-slate-900">Work order status</h2>
          <p className="mt-1 text-xs text-slate-500">Current company snapshot</p>
          <ul className="mt-4 space-y-2">
            {report.workOrderStatusSummary.map((row) => (
              <li key={row.status} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{formatWorkOrderStatusSummaryLabel(row.status)}</span>
                <span className="font-medium text-slate-900">{row.count}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h2 className="text-sm font-semibold text-slate-900">Invoice status</h2>
          <p className="mt-1 text-xs text-slate-500">Current company snapshot</p>
          <ul className="mt-4 space-y-2">
            {report.invoiceStatusSummary.map((row) => (
              <li key={row.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{formatInvoiceStatusLabel(row.status)}</span>
                  <span className="font-medium text-slate-900">{row.count}</span>
                </div>
                {row.totalMinor > 0 ? (
                  <p className="text-xs text-slate-400">
                    {formatOperationsReportMoney(row.totalMinor, report.currencyCode)} total
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <ReportTableSection
        title="Top service clients"
        description="Completed work and issued invoice revenue in the selected range."
        columns={["Client", "Work orders", "Services", "Invoices", "Revenue"]}
        rows={report.serviceClients.slice(0, 10).map((row) => [
          row.serviceClientName,
          String(row.completedWorkOrderCount),
          String(row.completedServiceLineCount),
          String(row.issuedInvoiceCount),
          formatOperationsReportMoney(row.revenueMinor, report.currencyCode)
        ])}
        emptyMessage="No service client activity in this range."
      />

      <ReportTableSection
        title="Top services"
        description="Service completions and invoiced line revenue in the selected range."
        columns={["Service", "Category", "Completed", "Revenue"]}
        rows={report.services.slice(0, 10).map((row) => [
          row.serviceName,
          row.serviceCategory ?? "—",
          String(row.completedCount),
          formatOperationsReportMoney(row.revenueMinor, report.currencyCode)
        ])}
        emptyMessage="No service completions in this range."
      />

      <ReportTableSection
        title="Employee productivity"
        description="Operational counts only — not payroll or pay rates."
        columns={["Employee", "Services completed", "Assignments", "Responsibility scans"]}
        rows={report.employees.slice(0, 10).map((row) => [
          row.employeeName,
          String(row.completedServiceLineCount),
          String(row.assignedWorkOrderCount),
          String(row.responsibilityConfirmedCount)
        ])}
        emptyMessage="No employee productivity activity in this range."
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
        <h2 className="text-sm font-semibold text-slate-900">Pending work</h2>
        <p className="mt-1 text-sm text-slate-500">
          {report.pendingWork.pendingWorkOrderCount} pending · {report.pendingWork.inProgressWorkOrderCount} in
          progress · {report.pendingWork.uninvoicedCompletedWorkOrderCount} completed but not invoiced
        </p>
        {report.pendingWork.sampleUninvoicedWorkOrders.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Work order</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {report.pendingWork.sampleUninvoicedWorkOrders.map((workOrder) => (
                  <tr key={workOrder.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{workOrder.workOrderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{workOrder.serviceClientName}</td>
                    <td className="px-4 py-3">
                      <Link href="/client-invoices" className="text-sm font-medium text-slate-900 underline">
                        Create invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No uninvoiced completed work orders right now.</p>
        )}
      </section>
    </div>
  );
}

type ReportTableSectionProps = {
  readonly title: string;
  readonly description: string;
  readonly columns: string[];
  readonly rows: string[][];
  readonly emptyMessage: string;
};

function ReportTableSection({ title, description, columns, rows, emptyMessage }: ReportTableSectionProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row, index) => (
                  <tr key={`${title}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${title}-${index}-${cellIndex}`}
                        className={`px-4 py-3 ${cellIndex === 0 ? "font-medium text-slate-900" : "text-slate-600"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {rows.map((row, index) => (
              <article key={`${title}-card-${index}`} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium text-slate-900">{row[0]}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  {columns.slice(1).map((column, columnIndex) => (
                    <div key={column} className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">{column}</dt>
                      <dd className="font-medium text-slate-900">{row[columnIndex + 1]}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
