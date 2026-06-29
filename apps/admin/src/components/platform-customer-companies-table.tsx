"use client";

import {
  formatPlatformCompanyAdminLabel,
  formatPlatformCompanyAdminStatus,
  formatPlatformCustomerLifecycleStatus,
  lifecycleStatusClassName,
  type PlatformCustomerCompanyRecord,
  type PlatformCustomerRecord
} from "../lib/platform-customer-utils";

type PlatformCustomerCompaniesTableProps = {
  readonly customer: PlatformCustomerRecord;
  readonly companies: PlatformCustomerCompanyRecord[];
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function PlatformCustomerCompaniesTable({
  customer,
  companies
}: PlatformCustomerCompaniesTableProps) {
  if (companies.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        No companies yet for this customer account.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-900">Companies under this customer</h2>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Company name</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created at</th>
              <th className="px-4 py-3 font-medium text-slate-600">Initial company admin</th>
              <th className="px-4 py-3 font-medium text-slate-600">Customer account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {companies.map((company) => (
              <tr key={company.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{company.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${lifecycleStatusClassName(company.lifecycleStatus)}`}
                  >
                    {formatPlatformCustomerLifecycleStatus(company.lifecycleStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">{formatTimestamp(company.createdAt)}</td>
                <td className="px-4 py-3 text-slate-700">
                  <p>{formatPlatformCompanyAdminLabel(company.initialAdmin)}</p>
                  {company.initialAdmin ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatPlatformCompanyAdminStatus(company.initialAdmin.status)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-700">{customer.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {companies.map((company) => (
          <article
            key={company.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{company.name}</h3>
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${lifecycleStatusClassName(company.lifecycleStatus)}`}
              >
                {formatPlatformCustomerLifecycleStatus(company.lifecycleStatus)}
              </span>
            </div>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="text-slate-500">Created at</dt>
                <dd>{formatTimestamp(company.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Initial company admin</dt>
                <dd>
                  {formatPlatformCompanyAdminLabel(company.initialAdmin)}
                  {company.initialAdmin ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatPlatformCompanyAdminStatus(company.initialAdmin.status)}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Customer account</dt>
                <dd>{customer.name}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}
