"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  minorUnitsToDollarInput,
  parseDollarsToMinorUnits,
  validateServiceCatalogName,
  type ServiceCatalogListRecord
} from "../lib/service-catalog-utils";

type EditServiceCatalogFormProps = {
  readonly item: ServiceCatalogListRecord;
  readonly onSaved?: () => void;
};

export function EditServiceCatalogForm({ item, onSaved }: EditServiceCatalogFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [priceDollars, setPriceDollars] = useState(minorUnitsToDollarInput(item.fixedPriceMinor));
  const [currencyCode, setCurrencyCode] = useState(item.currencyCode);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    priceDollars?: string;
  }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetFields() {
    setName(item.name);
    setDescription(item.description ?? "");
    setCategory(item.category ?? "");
    setPriceDollars(minorUnitsToDollarInput(item.fixedPriceMinor));
    setCurrencyCode(item.currencyCode);
    setFieldErrors({});
    setSubmitError(null);
  }

  function handleCancel() {
    resetFields();
    setIsEditing(false);
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

    const response = await fetch(`/api/company-operations/service-catalog/${item.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
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
      setSubmitError(payload.message ?? "Unable to update service.");
      return;
    }

    setSuccessMessage(`${payload.serviceCatalogItem?.name ?? name.trim()} was updated.`);
    setIsEditing(false);
    onSaved?.();
    router.refresh();
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => {
          resetFields();
          setSuccessMessage(null);
          setIsEditing(true);
        }}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        Edit
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-service-name-${item.id}`}>
          Service name
        </label>
        <input
          id={`edit-service-name-${item.id}`}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          disabled={isSubmitting}
        />
        {fieldErrors.name ? <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p> : null}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-service-description-${item.id}`}>
          Description
        </label>
        <textarea
          id={`edit-service-description-${item.id}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          disabled={isSubmitting}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-service-category-${item.id}`}>
            Category
          </label>
          <input
            id={`edit-service-category-${item.id}`}
            type="text"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700" htmlFor={`edit-service-price-${item.id}`}>
            Fixed service price
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id={`edit-service-price-${item.id}`}
              type="text"
              inputMode="decimal"
              value={priceDollars}
              onChange={(event) => setPriceDollars(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              disabled={isSubmitting}
            />
            <input
              type="text"
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())}
              maxLength={3}
              className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center text-xs uppercase text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              disabled={isSubmitting}
            />
          </div>
          {fieldErrors.priceDollars ? <p className="mt-1 text-xs text-red-600">{fieldErrors.priceDollars}</p> : null}
        </div>
      </div>

      {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
      {successMessage ? <p className="text-xs text-emerald-700">{successMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
