"use client";

import { useEffect, useState } from "react";

import { ArchiveEmployeeButton } from "./archive-employee-button";
import { EditEmployeeForm } from "./edit-employee-form";
import { EmployeeStatusBadge } from "./employee-status-badge";
import { RegeneratePinForm } from "./regenerate-pin-form";
import { SetEmployeeRateForm } from "./set-employee-rate-form";
import type { EmployeeRateRecord, EmployeeRecord } from "../lib/employee-utils";
import {
  DEFAULT_HOURLY_RATE_USD,
  employeeInitials,
  formatEmployeeDate,
  formatHourlyRate,
  resolveCurrentEmployeeRate
} from "../lib/employee-utils";

type EmployeeDetailDrawerProps = {
  readonly employee: EmployeeRecord | null;
  readonly companyName: string;
  readonly onClose: () => void;
};

export function EmployeeDetailDrawer({ employee, companyName, onClose }: EmployeeDetailDrawerProps) {
  const [rates, setRates] = useState<EmployeeRateRecord[]>([]);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [ratesReloadKey, setRatesReloadKey] = useState(0);

  useEffect(() => {
    if (!employee) {
      setRates([]);
      setRatesError(null);
      return;
    }

    let cancelled = false;

    const employeeId = employee.id;

    async function loadRates() {
      setIsLoadingRates(true);
      setRatesError(null);

      const response = await fetch(`/api/company-operations/employees/${employeeId}/rates`);
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        rates?: EmployeeRateRecord[];
      };

      if (cancelled) {
        return;
      }

      setIsLoadingRates(false);

      if (!response.ok) {
        setRatesError(payload.message ?? "Unable to load pay rates.");
        setRates([]);
        return;
      }

      setRates(Array.isArray(payload.rates) ? payload.rates : []);
    }

    void loadRates();

    return () => {
      cancelled = true;
    };
  }, [employee, ratesReloadKey]);

  if (!employee) {
    return null;
  }

  const currentRate = resolveCurrentEmployeeRate(rates);
  const isArchived = Boolean(employee.archivedAt);

  return (
    <>
      <button
        type="button"
        aria-label="Close employee detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="employee-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600">
              {employeeInitials(employee.fullName)}
            </div>
            <div className="min-w-0">
              <h2 id="employee-detail-title" className="truncate text-base font-semibold text-slate-900">
                {employee.fullName}
              </h2>
              <p className="text-xs text-slate-500">{companyName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <EmployeeStatusBadge archivedAt={employee.archivedAt} />
            <span className="text-xs text-slate-500">Added {formatEmployeeDate(employee.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Personal information</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs text-slate-500">Full name</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{employee.fullName}</p>
              <div className="mt-3">
                <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
              <p>{companyName}</p>
              <p className="mt-2 text-xs text-slate-500">
                Eligible kiosk locations are managed at the scheduling layer in version 1. This employee belongs to one
                company only.
              </p>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Kiosk PIN</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-sm text-slate-600">PINs are hashed and never displayed after they are saved.</p>
              <div className="mt-3">
                <RegeneratePinForm
                  employeeId={employee.id}
                  employeeName={employee.fullName}
                  disabled={isArchived}
                />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Pay rate</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              {isLoadingRates ? (
                <p className="text-sm text-slate-500">Loading rates…</p>
              ) : ratesError ? (
                <p className="text-sm text-red-600">{ratesError}</p>
              ) : (
                <>
                  <p className="text-lg font-semibold text-slate-900">
                    {currentRate
                      ? `${formatHourlyRate(currentRate.rateMinorUnits, currentRate.currencyCode)}/hr`
                      : `${formatHourlyRate(DEFAULT_HOURLY_RATE_USD * 100)}/hr`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Default is USD {DEFAULT_HOURLY_RATE_USD}/hour. Effective-dated overrides appear in rate history.
                  </p>
                  {rates.length > 1 ? (
                    <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-xs text-slate-600">
                      {rates.map((rate) => (
                        <li key={rate.id}>
                          {formatHourlyRate(rate.rateMinorUnits, rate.currencyCode)}/hr · from{" "}
                          {formatEmployeeDate(rate.effectiveStart)}
                          {rate.effectiveEnd ? ` to ${formatEmployeeDate(rate.effectiveEnd)}` : " · open-ended"}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <SetEmployeeRateForm
                    employeeId={employee.id}
                    disabled={isArchived}
                    onRateSet={() => setRatesReloadKey((key) => key + 1)}
                  />
                </>
              )}
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</h3>
            <ArchiveEmployeeButton
              employeeId={employee.id}
              fullName={employee.fullName}
              isArchived={isArchived}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
