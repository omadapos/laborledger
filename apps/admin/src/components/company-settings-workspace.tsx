"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  buildCompanyProfileUpdatePayload,
  COMPANY_PROFILE_HELPER_COPY,
  COMPANY_PROFILE_SECTION_TITLE,
  companyProfileApiPath,
  companyProfileToFormState,
  formatCompanyAddressLines,
  resolveCompanyDisplayName,
  validateCompanyProfileForm,
  type CompanyProfileFormState,
  type CompanyProfileRecord
} from "../lib/company-profile-utils";

type CompanySettingsWorkspaceProps = {
  readonly profile: CompanyProfileRecord;
  readonly canEdit: boolean;
};

const FIELD_CONFIG: Array<{
  key: keyof CompanyProfileFormState;
  label: string;
  type?: "email" | "tel" | "text";
}> = [
  { key: "legalName", label: "Legal name" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "billingEmail", label: "Billing email", type: "email" },
  { key: "primaryContactName", label: "Primary contact" },
  { key: "addressLine1", label: "Address line 1" },
  { key: "addressLine2", label: "Address line 2" },
  { key: "city", label: "City" },
  { key: "stateRegion", label: "State / region" },
  { key: "postalCode", label: "Postal code" },
  { key: "country", label: "Country" }
];

export function CompanySettingsWorkspace({ profile, canEdit }: CompanySettingsWorkspaceProps) {
  const router = useRouter();
  const [form, setForm] = useState<CompanyProfileFormState>(() => companyProfileToFormState(profile));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CompanyProfileFormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayName = resolveCompanyDisplayName(profile);
  const previewAddress = formatCompanyAddressLines(profile);

  function updateField(key: keyof CompanyProfileFormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const errors = validateCompanyProfileForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(companyProfileApiPath(profile.companyId), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildCompanyProfileUpdatePayload(form))
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to save company profile.");
      return;
    }

    setSuccessMessage("Company profile saved.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">{COMPANY_PROFILE_SECTION_TITLE}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Active company: <span className="font-medium text-slate-900">{profile.name}</span>
            {displayName !== profile.name ? (
              <span className="text-slate-500"> · Invoice display name: {displayName}</span>
            ) : null}
          </p>
          <p className="mt-2 text-sm text-slate-600">{COMPANY_PROFILE_HELPER_COPY}</p>
        </div>

        {!canEdit ? (
          <div className="space-y-4">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Company profile is read-only for supervisors. Ask a company administrator to update these
              details.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              {FIELD_CONFIG.map((field) => (
                <div key={field.key}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{field.label}</dt>
                  <dd className="mt-1 text-sm text-slate-900">{form[field.key] || "—"}</dd>
                </div>
              ))}
            </dl>
            {previewAddress.length > 0 ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Formatted address</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{previewAddress.join("\n")}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {FIELD_CONFIG.map((field) => (
                <div key={field.key} className={field.key.startsWith("address") ? "sm:col-span-2" : undefined}>
                  <label className="block text-sm font-medium text-slate-700" htmlFor={`company-profile-${field.key}`}>
                    {field.label}
                  </label>
                  <input
                    id={`company-profile-${field.key}`}
                    type={field.type ?? "text"}
                    value={form[field.key]}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                  {fieldErrors[field.key] ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors[field.key]}</p>
                  ) : null}
                </div>
              ))}
            </div>

            {submitError ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </p>
            ) : null}
            {successMessage ? (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {successMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Saving…" : "Save company profile"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
