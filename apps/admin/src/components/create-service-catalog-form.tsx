"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  parseDollarsToMinorUnits,
  serviceCatalogPricingDisclaimer,
  validateServiceCatalogName
} from "../lib/service-catalog-utils";

type CreateServiceCatalogFormProps = {
  readonly companyId: string;
};

export function CreateServiceCatalogForm({ companyId }: CreateServiceCatalogFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    priceDollars?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("");
    setPriceDollars("");
    setCurrencyCode("USD");
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleToggle() {
    setIsOpen((open) => {
      if (open) {
        resetForm();
        setSuccessMessage(null);
      }

      return !open;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const nameError = validateServiceCatalogName(name);
    const priceResult = parseDollarsToMinorUnits(priceDollars);
    const priceError = "error" in priceResult ? priceResult.error : undefined;

    if (nameError || priceError) {
      setFieldErrors({
        ...(nameError ? { name: nameError } : {}),
        ...(priceError ? { priceDollars: priceError } : {})
      });
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/service-catalog`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        fixedPriceMinor: priceResult.minorUnits,
        currencyCode: currencyCode.trim().toUpperCase() || "USD"
      })
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      serviceCatalogItem?: { name?: string };
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create service.");
      return;
    }

    const createdName = payload.serviceCatalogItem?.name ?? name.trim();
    setSuccessMessage(`${createdName} was added to the catalog.`);
    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {isOpen ? "Cancel" : "Create service"}
      </button>

      {successMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/30"
        >
          <h2 className="text-sm font-semibold text-slate-900">New catalog service</h2>
          <p className="mt-1 text-sm text-slate-500">{serviceCatalogPricingDisclaimer()}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="service-catalog-name">
                Service name
              </label>
              <input
                id="service-catalog-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Interior detailing"
                autoComplete="off"
                disabled={isSubmitting}
              />
              {fieldErrors.name ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.name}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="service-catalog-description">
                Description
              </label>
              <textarea
                id="service-catalog-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Optional notes for admins"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="service-catalog-category">
                Category
              </label>
              <input
                id="service-catalog-category"
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Detailing"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="service-catalog-price">
                Fixed service price
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="service-catalog-price"
                  type="text"
                  inputMode="decimal"
                  value={priceDollars}
                  onChange={(event) => setPriceDollars(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="125.00"
                  autoComplete="off"
                  disabled={isSubmitting}
                />
                <input
                  id="service-catalog-currency"
                  type="text"
                  value={currencyCode}
                  onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
                  maxLength={3}
                  className="w-20 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm uppercase text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  disabled={isSubmitting}
                />
              </div>
              {fieldErrors.priceDollars ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.priceDollars}</p>
              ) : (
                <p className="mt-1.5 text-xs text-slate-500">Client-facing service amount per job.</p>
              )}
            </div>
          </div>

          {submitError ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Creating…" : "Create service"}
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
