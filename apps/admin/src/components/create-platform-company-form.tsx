"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  buildListCustomerCompaniesApiPath,
  validateCreatePlatformCompanyInput,
  type CreatePlatformCompanyResponse,
  type PlatformCustomerCompanyRecord,
  type PlatformCustomerRecord
} from "../lib/platform-customer-utils";
import { PlatformCustomerCompaniesTable } from "./platform-customer-companies-table";

type CreatePlatformCompanyFormProps = {
  readonly customer: PlatformCustomerRecord;
  readonly defaultOpen?: boolean;
};

export function CreatePlatformCompanyForm({
  customer,
  defaultOpen = false
}: CreatePlatformCompanyFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [companyName, setCompanyName] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<CreatePlatformCompanyResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setCompanyName("");
    setAdminFullName("");
    setAdminEmail("");
    setFieldErrors({});
    setSubmitError(null);
    setSuccessResult(null);
  }

  function handleToggle() {
    setIsOpen((open) => {
      if (open) {
        resetForm();
      }

      return !open;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessResult(null);

    const nextFieldErrors = validateCreatePlatformCompanyInput({
      companyName,
      adminFullName,
      adminEmail
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(buildListCustomerCompaniesApiPath(customer.id), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        companyName,
        adminFullName,
        adminEmail
      })
    });

    const payload = (await response.json().catch(() => ({}))) as CreatePlatformCompanyResponse & {
      message?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create company.");
      return;
    }

    setSuccessResult(payload);
    setCompanyName("");
    setAdminFullName("");
    setAdminEmail("");
    setFieldErrors({});
    setIsOpen(false);
    router.refresh();
  }

  const canCreate = customer.lifecycleStatus === "ACTIVE";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Create company</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add another company workspace under {customer.name}. An invitation email is sent to the initial
            company admin.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={handleToggle}
            className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
          >
            {isOpen ? "Close form" : "Create company"}
          </button>
        ) : null}
      </div>

      {!canCreate ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Companies can only be created for active customer accounts.
        </p>
      ) : null}

      {successResult ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>
            Created <span className="font-semibold">{successResult.company.name}</span> under customer
            account <span className="font-semibold">{customer.name}</span>.
          </p>
          <p className="mt-2">
            Initial company admin invitation created. Share the invite link from your email provider in
            development, or use the accept-invite flow with the issued token.
          </p>
        </div>
      ) : null}

      {submitError ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </p>
      ) : null}

      {isOpen && canCreate ? (
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="company-name">
              Company name
            </label>
            <input
              id="company-name"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              autoComplete="organization"
            />
            {fieldErrors.companyName ? (
              <p className="mt-1.5 text-sm text-red-600">{fieldErrors.companyName}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="admin-full-name">
              Initial company admin name
            </label>
            <input
              id="admin-full-name"
              value={adminFullName}
              onChange={(event) => setAdminFullName(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              autoComplete="name"
            />
            {fieldErrors.adminFullName ? (
              <p className="mt-1.5 text-sm text-red-600">{fieldErrors.adminFullName}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="admin-email">
              Initial company admin email
            </label>
            <input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(event) => setAdminEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              autoComplete="email"
            />
            {fieldErrors.adminEmail ? (
              <p className="mt-1.5 text-sm text-red-600">{fieldErrors.adminEmail}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            {isSubmitting ? "Creating company…" : "Create company"}
          </button>
        </form>
      ) : null}
    </section>
  );
}

type PlatformCustomerCompaniesWorkspaceProps = {
  readonly customer: PlatformCustomerRecord;
  readonly companies: PlatformCustomerCompanyRecord[];
  readonly defaultCreateOpen?: boolean;
};

export function PlatformCustomerCompaniesWorkspace({
  customer,
  companies,
  defaultCreateOpen = false
}: PlatformCustomerCompaniesWorkspaceProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          Customer account: <span className="font-semibold text-slate-900">{customer.name}</span>
        </p>
        <p className="mt-1">
          {customer.companyCount} {customer.companyCount === 1 ? "company" : "companies"} · Owner:{" "}
          {customer.owner?.email ?? "Not assigned"}
        </p>
        <Link
          href="/platform/customers"
          className="mt-2 inline-flex text-sm font-medium text-violet-700 hover:text-violet-900"
        >
          Back to customer accounts
        </Link>
      </div>

      <CreatePlatformCompanyForm customer={customer} defaultOpen={defaultCreateOpen} />
      <PlatformCustomerCompaniesTable customer={customer} companies={companies} />
    </div>
  );
}
