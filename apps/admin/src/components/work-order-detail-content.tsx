"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { AssignWorkOrderForm } from "./assign-work-order-form";
import { CancelWorkOrderButton } from "./cancel-work-order-button";
import { EditWorkOrderForm } from "./edit-work-order-form";
import { UnassignWorkOrderButton } from "./unassign-work-order-button";
import { WorkOrderStatusBadge } from "./work-order-status-badge";
import {
  assignmentDisclaimer,
  formatAssignedEmployeeLabel,
  formatLastResponsibilityConfirmation,
  formatResponsibilityLogSummary,
  formatServiceLineCompletionStatus,
  formatServiceLineCompletionSummary,
  formatWorkerScanSummary,
  formatWorkOrderCompletionProgress,
  formatWorkOrderDate,
  formatWorkOrderMoney,
  formatWorkOrderStatusLabel,
  formatWorkOrderVehicleSummary,
  workOrderDisclaimer,
  type WorkOrderListRecord
} from "../lib/work-order-utils";
import { formatJobInvoiceStatus } from "../lib/jobs-utils";
import type { EmployeeRecord } from "../lib/employee-utils";

type WorkOrderDetailContentProps = {
  readonly workOrder: WorkOrderListRecord;
  readonly companyName: string;
  readonly employees: EmployeeRecord[];
  readonly canManageAssignments: boolean;
  readonly onChanged?: () => void;
};

export function WorkOrderDetailContent({
  workOrder,
  companyName,
  employees,
  canManageAssignments,
  onChanged
}: WorkOrderDetailContentProps) {
  const router = useRouter();
  const currencyCode = workOrder.serviceLines[0]?.currencyCode ?? "USD";
  const isCancelled = workOrder.status === "CANCELLED";
  const isCompleted = workOrder.status === "COMPLETED";
  const isInvoiced = workOrder.status === "INVOICED";
  const isClosed = isCancelled || isCompleted || isInvoiced;

  function handleChanged() {
    onChanged?.();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-slate-500">{companyName}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <WorkOrderStatusBadge status={workOrder.status} />
          <span className="text-xs text-slate-500">Created {formatWorkOrderDate(workOrder.createdAt)}</span>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-800">
          {formatWorkOrderCompletionProgress(workOrder)}
        </p>
        <p className="mt-1 text-sm text-slate-600">Invoice: {formatJobInvoiceStatus(workOrder.status)}</p>
      </div>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Vehicle</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
          <p className="font-medium text-slate-900">{formatWorkOrderVehicleSummary(workOrder.vehicle)}</p>
          <p className="mt-2 text-xs text-slate-500">
            Client: {workOrder.serviceClient.name} · Location: {workOrder.location.name}
          </p>
          {workOrder.vehicle.plate ? (
            <p className="mt-1 text-xs text-slate-500">Plate: {workOrder.vehicle.plate}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Service lines</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <ul className="space-y-3">
            {workOrder.serviceLines.map((line) => (
              <li key={line.id} className="border-b border-slate-200/80 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{line.serviceNameSnapshot}</p>
                  <span
                    className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      line.activeCompletion
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {formatServiceLineCompletionStatus(line.activeCompletion)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {line.serviceCategorySnapshot ?? "No category"} · Snapshotted at create
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {formatWorkOrderMoney(line.lineTotalMinor, line.currencyCode)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatServiceLineCompletionSummary(line.activeCompletion)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-900">
            Total: {formatWorkOrderMoney(workOrder.totalServiceAmountMinor, currencyCode)}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Assignment</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-medium text-slate-900">
            {formatAssignedEmployeeLabel(workOrder.assignedEmployee)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{assignmentDisclaimer()}</p>

          {canManageAssignments && !isClosed ? (
            <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
              {workOrder.activeAssignmentId && workOrder.assignedEmployee ? (
                <UnassignWorkOrderButton
                  assignmentId={workOrder.activeAssignmentId}
                  employeeName={workOrder.assignedEmployee.fullName}
                  onUnassigned={handleChanged}
                />
              ) : null}
              <AssignWorkOrderForm workOrder={workOrder} employees={employees} onAssigned={handleChanged} />
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Worker confirmation</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-medium text-slate-900">
            {formatLastResponsibilityConfirmation(workOrder.lastResponsibilityConfirmation)}
          </p>
          {workOrder.lastResponsibilityConfirmation?.acceptedAt ? (
            <p className="mt-1 text-xs text-slate-500">
              Confirmed {formatWorkOrderDate(workOrder.lastResponsibilityConfirmation.acceptedAt)}
            </p>
          ) : null}
          {workOrder.workerScanEvents && workOrder.workerScanEvents.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm text-slate-700">
              {workOrder.workerScanEvents.slice(0, 5).map((scan) => (
                <li key={scan.id}>
                  {formatWorkerScanSummary(scan)}
                  <span className="ml-2 text-xs text-slate-400">{formatWorkOrderDate(scan.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-slate-500">No worker scan events yet.</p>
          )}
        </div>
      </section>

      {workOrder.responsibilityLogs && workOrder.responsibilityLogs.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
            Responsibility history
          </h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <ul className="space-y-2 text-sm text-slate-700">
              {workOrder.responsibilityLogs.map((log) => (
                <li key={log.id}>
                  {formatResponsibilityLogSummary(log)}
                  <span className="ml-2 text-xs text-slate-400">{formatWorkOrderDate(log.occurredAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Details</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          {workOrder.notes ? (
            <p className="text-sm text-slate-900">{workOrder.notes}</p>
          ) : (
            <p className="text-sm text-slate-500">No notes</p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{workOrderDisclaimer()}</p>
          {canManageAssignments ? <EditWorkOrderForm workOrder={workOrder} onSaved={handleChanged} /> : null}
        </div>
      </section>

      {workOrder.statusHistory && workOrder.statusHistory.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status history</h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <ul className="space-y-2 text-sm text-slate-700">
              {workOrder.statusHistory.map((entry) => (
                <li key={entry.id}>
                  {entry.fromStatus
                    ? `${formatWorkOrderStatusLabel(entry.fromStatus)} → ${formatWorkOrderStatusLabel(entry.toStatus)}`
                    : formatWorkOrderStatusLabel(entry.toStatus)}
                  <span className="ml-2 text-xs text-slate-400">{formatWorkOrderDate(entry.createdAt)}</span>
                  {entry.reason ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{entry.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {canManageAssignments && !isClosed ? (
        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <CancelWorkOrderButton
              workOrderId={workOrder.id}
              workOrderNumber={workOrder.workOrderNumber}
              isCancelled={isCancelled}
              onStatusChange={handleChanged}
            />
            {workOrder.status === "COMPLETED" ? (
              <Link
                href="/client-invoices"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Create invoice draft
              </Link>
            ) : null}
          </div>
        </section>
      ) : workOrder.cancelReason ? (
        <section className="space-y-3">
          <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Cancellation</h3>
          <p className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
            {workOrder.cancelReason}
          </p>
        </section>
      ) : null}
    </div>
  );
}
