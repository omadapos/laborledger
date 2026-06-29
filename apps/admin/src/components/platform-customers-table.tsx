"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  availableLifecycleActions,
  buildArchiveCustomerPath,
  buildCustomerCompaniesPath,
  buildReactivateCustomerPath,
  buildSuspendCustomerPath,
  filterPlatformCustomers,
  formatPlatformCustomerLifecycleStatus,
  formatPlatformCustomerOwnerLabel,
  formatPlatformCustomerOwnerStatus,
  formatPlatformCustomerPrimaryCompany,
  lifecycleStatusClassName,
  PLATFORM_LIFECYCLE_ARCHIVE_WARNING,
  PLATFORM_LIFECYCLE_SUSPEND_WARNING,
  validateLifecycleReason,
  type PlatformCustomerRecord
} from "../lib/platform-customer-utils";

type PlatformCustomersTableProps = {
  readonly customers: PlatformCustomerRecord[];
};

type PendingAction =
  | { type: "suspend"; customer: PlatformCustomerRecord }
  | { type: "archive"; customer: PlatformCustomerRecord }
  | null;

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function PlatformCustomersTable({ customers }: PlatformCustomersTableProps) {
  const router = useRouter();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busyCustomerId, setBusyCustomerId] = useState<string | null>(null);

  const visibleCustomers = useMemo(
    () => filterPlatformCustomers(customers, includeArchived),
    [customers, includeArchived]
  );

  async function runLifecycleRequest(
    customer: PlatformCustomerRecord,
    action: "suspend" | "reactivate" | "archive",
    body?: { reason: string }
  ) {
    setBusyCustomerId(customer.id);
    setSubmitError(null);
    setSuccessMessage(null);

    const path =
      action === "suspend"
        ? buildSuspendCustomerPath(customer.id)
        : action === "reactivate"
          ? buildReactivateCustomerPath(customer.id)
          : buildArchiveCustomerPath(customer.id);

    const init: RequestInit = { method: "POST" };
    if (body) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const response = await fetch(path, init);

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setBusyCustomerId(null);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update customer status.");
      return;
    }

    setPendingAction(null);
    setReason("");
    setReasonError(null);
    setSuccessMessage(`${customer.name} is now ${action === "reactivate" ? "active" : action === "suspend" ? "suspended" : "archived"}.`);
    router.refresh();
  }

  function submitPendingAction() {
    if (!pendingAction) {
      return;
    }

    const validationError = validateLifecycleReason(pendingAction.type, reason);
    if (validationError) {
      setReasonError(validationError);
      return;
    }

    setReasonError(null);
    void runLifecycleRequest(pendingAction.customer, pendingAction.type, { reason: reason.trim() });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p>{PLATFORM_LIFECYCLE_SUSPEND_WARNING}</p>
          <p className="mt-1">{PLATFORM_LIFECYCLE_ARCHIVE_WARNING}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Show archived customers
        </label>
      </div>

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {submitError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      {visibleCustomers.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No customer accounts match the current filter.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-600">Customer</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Primary company</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Owner</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Lifecycle</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {visibleCustomers.map((customer) => (
                  <CustomerRow
                    key={customer.id}
                    customer={customer}
                    busy={busyCustomerId === customer.id}
                    onSuspend={() => {
                      setPendingAction({ type: "suspend", customer });
                      setReason("");
                      setReasonError(null);
                    }}
                    onReactivate={() => void runLifecycleRequest(customer, "reactivate")}
                    onArchive={() => {
                      setPendingAction({ type: "archive", customer });
                      setReason("");
                      setReasonError(null);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {visibleCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                busy={busyCustomerId === customer.id}
                onSuspend={() => {
                  setPendingAction({ type: "suspend", customer });
                  setReason("");
                  setReasonError(null);
                }}
                onReactivate={() => void runLifecycleRequest(customer, "reactivate")}
                onArchive={() => {
                  setPendingAction({ type: "archive", customer });
                  setReason("");
                  setReasonError(null);
                }}
              />
            ))}
          </div>
        </>
      )}

      {pendingAction ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            {pendingAction.type === "suspend" ? "Suspend customer" : "Archive customer"}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {pendingAction.customer.name} · {formatPlatformCustomerPrimaryCompany(pendingAction.customer)}
          </p>

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="lifecycle-reason">
            Reason
          </label>
          <textarea
            id="lifecycle-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            placeholder={
              pendingAction.type === "suspend"
                ? "Why is this customer being suspended?"
                : "Why is this customer being archived?"
            }
          />
          {reasonError ? <p className="mt-1.5 text-sm text-red-600">{reasonError}</p> : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={submitPendingAction}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
                pendingAction.type === "archive" ? "bg-red-700 hover:bg-red-800" : "bg-amber-700 hover:bg-amber-800"
              }`}
            >
              {pendingAction.type === "suspend" ? "Confirm suspend" : "Confirm archive"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingAction(null);
                setReason("");
                setReasonError(null);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type CustomerActionsProps = {
  readonly customer: PlatformCustomerRecord;
  readonly busy: boolean;
  readonly onSuspend: () => void;
  readonly onReactivate: () => void;
  readonly onArchive: () => void;
};

function CustomerActions({ customer, busy, onSuspend, onReactivate, onArchive }: CustomerActionsProps) {
  const actions = availableLifecycleActions(customer.lifecycleStatus);
  const companiesPath = buildCustomerCompaniesPath(customer.id);
  const createCompanyPath = `${companiesPath}?create=1`;

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={companiesPath}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
      >
        View companies
      </Link>
      {customer.lifecycleStatus === "ACTIVE" ? (
        <Link
          href={createCompanyPath}
          className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-100"
        >
          Create company
        </Link>
      ) : null}
      {actions.canSuspend ? (
        <button
          type="button"
          disabled={busy}
          onClick={onSuspend}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-50"
        >
          Suspend
        </button>
      ) : null}
      {actions.canReactivate ? (
        <button
          type="button"
          disabled={busy}
          onClick={onReactivate}
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50"
        >
          Reactivate
        </button>
      ) : null}
      {actions.canArchive ? (
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 disabled:opacity-50"
        >
          Archive
        </button>
      ) : null}
    </div>
  );
}

function CustomerRow({
  customer,
  busy,
  onSuspend,
  onReactivate,
  onArchive
}: CustomerActionsProps) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-900">{customer.name}</td>
      <td className="px-4 py-3 text-slate-700">{formatPlatformCustomerPrimaryCompany(customer)}</td>
      <td className="px-4 py-3 text-slate-700">{formatPlatformCustomerOwnerLabel(customer.owner)}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${lifecycleStatusClassName(customer.lifecycleStatus)}`}
        >
          {formatPlatformCustomerLifecycleStatus(customer.lifecycleStatus)}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p>{formatPlatformCustomerOwnerStatus(customer.ownerStatus)}</p>
        {customer.suspendedReason ? <p className="mt-1">Suspended: {customer.suspendedReason}</p> : null}
        {customer.archivedReason ? <p className="mt-1">Archived: {customer.archivedReason}</p> : null}
        {customer.suspendedAt ? <p className="mt-1">Since {formatTimestamp(customer.suspendedAt)}</p> : null}
        {customer.archivedAt ? <p className="mt-1">Since {formatTimestamp(customer.archivedAt)}</p> : null}
      </td>
      <td className="px-4 py-3">
        <CustomerActions
          customer={customer}
          busy={busy}
          onSuspend={onSuspend}
          onReactivate={onReactivate}
          onArchive={onArchive}
        />
      </td>
    </tr>
  );
}

function CustomerCard({
  customer,
  busy,
  onSuspend,
  onReactivate,
  onArchive
}: CustomerActionsProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">{customer.name}</h2>
        <span
          className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${lifecycleStatusClassName(customer.lifecycleStatus)}`}
        >
          {formatPlatformCustomerLifecycleStatus(customer.lifecycleStatus)}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm text-slate-700">
        <div>
          <dt className="text-slate-500">Primary company</dt>
          <dd>{formatPlatformCustomerPrimaryCompany(customer)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Owner</dt>
          <dd>{formatPlatformCustomerOwnerLabel(customer.owner)}</dd>
        </div>
        {customer.suspendedReason ? (
          <div>
            <dt className="text-slate-500">Suspension reason</dt>
            <dd>{customer.suspendedReason}</dd>
          </div>
        ) : null}
        {customer.archivedReason ? (
          <div>
            <dt className="text-slate-500">Archive reason</dt>
            <dd>{customer.archivedReason}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4">
        <CustomerActions
          customer={customer}
          busy={busy}
          onSuspend={onSuspend}
          onReactivate={onReactivate}
          onArchive={onArchive}
        />
      </div>
    </article>
  );
}
