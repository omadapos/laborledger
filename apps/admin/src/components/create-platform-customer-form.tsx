"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  generateTemporaryPassword,
  temporaryPasswordWarningCopy,
  validateCreatePlatformCustomerInput,
  type CreatePlatformCustomerResponse
} from "../lib/platform-customer-utils";

type CreatePlatformCustomerFormProps = {
  readonly onCreated?: () => void;
};

export function CreatePlatformCustomerForm({ onCreated }: CreatePlatformCustomerFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<CreatePlatformCustomerResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setCustomerName("");
    setCompanyName("");
    setOwnerFullName("");
    setOwnerEmail("");
    setOwnerPassword("");
    setConfirmPassword("");
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

  function handleGeneratePassword() {
    const generated = generateTemporaryPassword();
    setOwnerPassword(generated);
    setConfirmPassword(generated);
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.ownerPassword;
      delete next.confirmPassword;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessResult(null);

    const nextFieldErrors = validateCreatePlatformCustomerInput({
      customerName,
      companyName,
      ownerFullName,
      ownerEmail,
      ownerPassword,
      confirmPassword
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch("/api/platform/customers", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        customerName: customerName.trim(),
        companyName: companyName.trim(),
        ownerFullName: ownerFullName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        ownerPassword
      })
    });

    const payload = (await response.json().catch(() => ({}))) as CreatePlatformCustomerResponse & {
      message?: string;
    };

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create customer.");
      setIsSubmitting(false);
      return;
    }

    setSuccessResult(payload);
    resetForm();
    setIsSubmitting(false);
    onCreated?.();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleToggle}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {isOpen ? "Close form" : "Create customer"}
      </button>

      {successResult ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Customer account created</p>
          <p className="mt-2">
            <span className="font-medium">{successResult.customer.name}</span> with company{" "}
            <span className="font-medium">{successResult.company.name}</span>.
          </p>
          <p className="mt-2">
            Owner login: <span className="font-mono">{successResult.owner.email}</span>
          </p>
          <p className="mt-3 font-medium text-amber-900">{temporaryPasswordWarningCopy()}</p>
          <p className="mt-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-sm text-slate-900">
            {successResult.temporaryPassword}
          </p>
          <button
            type="button"
            onClick={() => setSuccessResult(null)}
            className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Customer / account name</span>
              <input
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                autoComplete="off"
              />
              {fieldErrors.customerName ? (
                <span className="mt-1 block text-red-600">{fieldErrors.customerName}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Initial company name</span>
              <input
                type="text"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                autoComplete="off"
              />
              {fieldErrors.companyName ? (
                <span className="mt-1 block text-red-600">{fieldErrors.companyName}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Owner name</span>
              <input
                type="text"
                value={ownerFullName}
                onChange={(event) => setOwnerFullName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                autoComplete="name"
              />
              {fieldErrors.ownerFullName ? (
                <span className="mt-1 block text-red-600">{fieldErrors.ownerFullName}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Owner email</span>
              <input
                type="email"
                value={ownerEmail}
                onChange={(event) => setOwnerEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                autoComplete="off"
              />
              {fieldErrors.ownerEmail ? (
                <span className="mt-1 block text-red-600">{fieldErrors.ownerEmail}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Temporary password</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ownerPassword}
                  onChange={(event) => setOwnerPassword(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Generate
                </button>
              </div>
              {fieldErrors.ownerPassword ? (
                <span className="mt-1 block text-red-600">{fieldErrors.ownerPassword}</span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Confirm temporary password</span>
              <input
                type="text"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword ? (
                <span className="mt-1 block text-red-600">{fieldErrors.confirmPassword}</span>
              ) : null}
            </label>
          </div>

          {submitError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create customer account"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
