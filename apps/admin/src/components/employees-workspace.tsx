"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CreateEmployeeForm } from "./create-employee-form";
import { EditEmployeeForm } from "./edit-employee-form";
import { EmployeeDetailDrawer } from "./employee-detail-drawer";
import { EmployeeStatusBadge } from "./employee-status-badge";
import type { CompanyRecord, EmployeeRecord } from "../lib/employee-utils";
import {
  employeeInitials,
  filterEmployeesByQuery,
  formatEmployeeDate
} from "../lib/employee-utils";

type EmployeesWorkspaceProps = {
  readonly companies: CompanyRecord[];
  readonly selectedCompany: CompanyRecord;
  readonly employees: EmployeeRecord[];
  readonly initialQuery: string;
  readonly initialStatus: "active" | "inactive" | "all";
};

export function EmployeesWorkspace({
  companies,
  selectedCompany,
  employees,
  initialQuery,
  initialStatus
}: EmployeesWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const filteredEmployees = useMemo(() => filterEmployeesByQuery(employees, query), [employees, query]);

  const selectedEmployee =
    filteredEmployees.find((employee) => employee.id === selectedEmployeeId) ??
    employees.find((employee) => employee.id === selectedEmployeeId) ??
    null;

  function buildEmployeesHref(overrides: { companyId?: string; status?: string; q?: string }) {
    const params = new URLSearchParams();
    params.set("companyId", overrides.companyId ?? selectedCompany.id);

    const status = overrides.status ?? initialStatus;
    if (status !== "active") {
      params.set("status", status);
    }

    const search = overrides.q ?? query;
    if (search.trim()) {
      params.set("q", search.trim());
    }

    return `/employees?${params.toString()}`;
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <CreateEmployeeForm companyId={selectedCompany.id} />
      </div>

      {companies.length > 1 ? (
        <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Company</p>
          <div className="flex flex-wrap gap-2">
            {companies.map((company) => {
              const isSelected = company.id === selectedCompany.id;
              return (
                <Link
                  key={company.id}
                  href={buildEmployeesHref({ companyId: company.id })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 font-medium text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {company.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <label className="block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400" htmlFor="employee-search">
            Search
          </label>
          <input
            id="employee-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name…"
            className="mt-1.5 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Status</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {(["active", "inactive", "all"] as const).map((status) => {
              const isSelected = initialStatus === status;
              const label = status === "active" ? "Active" : status === "inactive" ? "Inactive" : "All";
              return (
                <Link
                  key={status}
                  href={buildEmployeesHref({ status })}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    isSelected
                      ? "border-brand-600 bg-brand-50 font-medium text-brand-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {filteredEmployees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-800">
            {employees.length === 0 ? "No employees yet" : "No employees match your search"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {employees.length === 0
              ? "Create the first employee for this company to enable kiosk timekeeping."
              : "Try a different name or clear the search filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/30 md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Employee</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Status</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Created</th>
                    <th className="px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(employee.id)}
                          className="flex w-full items-center gap-3 text-left"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">
                            {employeeInitials(employee.fullName)}
                          </div>
                          <span className="font-medium text-slate-900 hover:text-brand-700">{employee.fullName}</span>
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <EmployeeStatusBadge archivedAt={employee.archivedAt} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatEmployeeDate(employee.createdAt)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedEmployeeId(employee.id)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredEmployees.map((employee) => (
              <article
                key={employee.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                      {employeeInitials(employee.fullName)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{employee.fullName}</p>
                      <p className="text-xs text-slate-500">{formatEmployeeDate(employee.createdAt)}</p>
                    </div>
                  </div>
                  <EmployeeStatusBadge archivedAt={employee.archivedAt} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(employee.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    View details
                  </button>
                  <EditEmployeeForm employeeId={employee.id} initialFullName={employee.fullName} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <EmployeeDetailDrawer
        employee={selectedEmployee}
        companyName={selectedCompany.name}
        onClose={() => setSelectedEmployeeId(null)}
      />
    </>
  );
}
