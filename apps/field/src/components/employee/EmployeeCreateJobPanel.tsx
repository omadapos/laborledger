"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { WorkerCameraScan } from "@/components/worker/WorkerCameraScan";
import type { FieldJobOptionsResponse } from "@/lib/field-jobs-client";
import { isBrowserOffline } from "@/lib/offline";
import {
  parseScannerVinInput,
  shouldAutoSubmitScannerVin,
  validateWorkerVin,
  VIN_LENGTH,
  WORKER_SCANNER_HELPER_COPY
} from "@/lib/worker-scanner-utils";
import { normalizeVinInput } from "@/lib/worker-utils";

export type FieldCreateJobSuccess = {
  serviceName: string;
  serviceClientName: string;
  vehicleVin: string;
  vehicleTitle?: string;
  notes?: string | null;
  workOrderNumber: string;
  message?: string;
};

export function EmployeeCreateJobPanel() {
  const router = useRouter();
  const vinInputRef = useRef<HTMLInputElement | null>(null);

  const [options, setOptions] = useState<FieldJobOptionsResponse | null>(null);
  const [enteredVin, setEnteredVin] = useState("");
  const [serviceClientId, setServiceClientId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [serviceCatalogItemId, setServiceCatalogItemId] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<FieldCreateJobSuccess | null>(null);

  const filteredLocations = useMemo(
    () =>
      (options?.locations ?? []).filter((location) => location.serviceClientId === serviceClientId),
    [options?.locations, serviceClientId]
  );

  const loadOptions = useCallback(async () => {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to load job options.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/field/jobs/options", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as FieldJobOptionsResponse & {
        message?: string;
      };

      if (response.status === 401) {
        router.replace("/field/login");
        return;
      }

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to load job options.");
        setIsLoading(false);
        return;
      }

      setOptions(payload);
      setIsLoading(false);
    } catch {
      setErrorMessage("Network error while loading job options.");
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    window.setTimeout(() => vinInputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!serviceClientId) {
      setLocationId("");
      return;
    }

    if (!filteredLocations.some((location) => location.id === locationId)) {
      setLocationId(filteredLocations[0]?.id ?? "");
    }
  }, [filteredLocations, locationId, serviceClientId]);

  function handleVinChange(value: string) {
    setEnteredVin(parseScannerVinInput(value).slice(0, VIN_LENGTH));
  }

  function handleVinKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab") {
      if (shouldAutoSubmitScannerVin(enteredVin, event.key === "Enter" ? "Enter" : "Tab")) {
        event.preventDefault();
      }
    }
  }

  async function handleSubmit() {
    const normalizedVin = normalizeVinInput(enteredVin);
    const validationError = validateWorkerVin(normalizedVin);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!serviceClientId || !locationId || !serviceCatalogItemId) {
      setErrorMessage("Select customer, location, and service.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Job was not submitted.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/field/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enteredVin: normalizedVin,
          serviceClientId,
          locationId,
          serviceCatalogItemId,
          notes: notes.trim() || undefined
        })
      });

      const payload = (await response.json().catch(() => ({}))) as FieldCreateJobSuccess & {
        message?: string;
      };

      if (response.status === 401) {
        router.replace("/field/login");
        return;
      }

      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to create job.");
        return;
      }

      setSuccess({
        serviceName: payload.serviceName,
        serviceClientName: payload.serviceClientName,
        vehicleVin: payload.vehicleVin,
        vehicleTitle: payload.vehicleTitle,
        notes: payload.notes,
        workOrderNumber: payload.workOrderNumber,
        message: payload.message
      });
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error. Job was not submitted.");
    }
  }

  function handleStartAnother() {
    setEnteredVin("");
    setNotes("");
    setSuccess(null);
    setErrorMessage(null);
    window.setTimeout(() => vinInputRef.current?.focus(), 0);
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading job options…
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-emerald-900">Complete</h2>
        <p className="mt-2 text-sm text-emerald-800">
          {success.message ?? "Job created and marked complete."}
        </p>
        <dl className="mt-4 space-y-2 text-sm text-emerald-900">
          <div>
            <dt className="font-medium">Service</dt>
            <dd>{success.serviceName}</dd>
          </div>
          <div>
            <dt className="font-medium">Customer</dt>
            <dd>{success.serviceClientName}</dd>
          </div>
          <div>
            <dt className="font-medium">VIN</dt>
            <dd className="font-mono">{success.vehicleVin}</dd>
          </div>
          {success.notes ? (
            <div>
              <dt className="font-medium">Notes</dt>
              <dd>{success.notes}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleStartAnother}
            className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Start another job
          </button>
          <Link
            href="/field/home"
            className="inline-flex justify-center rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-900"
          >
            Home
          </Link>
          <Link
            href="/field/summary"
            className="inline-flex justify-center rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-900"
          >
            Summary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
        <h2 className="text-xl font-semibold text-slate-900">Create new job</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter the VIN, choose customer, location, and service, then complete the job.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="create-job-vin">
          VIN
        </label>
        <p className="mt-1 text-xs text-slate-500">{WORKER_SCANNER_HELPER_COPY}</p>
        <input
          ref={vinInputRef}
          id="create-job-vin"
          value={enteredVin}
          onChange={(event) => handleVinChange(event.target.value)}
          onKeyDown={handleVinKeyDown}
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-4 font-mono text-lg uppercase tracking-widest disabled:bg-slate-50"
          maxLength={VIN_LENGTH}
          disabled={isBusy}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />

        <div className="mt-4">
          <WorkerCameraScan
            disabled={isBusy}
            onDetected={(value) => {
              handleVinChange(value);
            }}
          />
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="create-job-customer">
          Customer
        </label>
        <select
          id="create-job-customer"
          value={serviceClientId}
          onChange={(event) => setServiceClientId(event.target.value)}
          disabled={isBusy || (options?.serviceClients.length ?? 0) === 0}
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-50"
        >
          <option value="">Select customer…</option>
          {(options?.serviceClients ?? []).map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="create-job-location">
          Location
        </label>
        <select
          id="create-job-location"
          value={locationId}
          onChange={(event) => setLocationId(event.target.value)}
          disabled={isBusy || !serviceClientId || filteredLocations.length === 0}
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-50"
        >
          <option value="">Select location…</option>
          {filteredLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="create-job-service">
          Service
        </label>
        <select
          id="create-job-service"
          value={serviceCatalogItemId}
          onChange={(event) => setServiceCatalogItemId(event.target.value)}
          disabled={isBusy || (options?.serviceCatalogItems.length ?? 0) === 0}
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-50"
        >
          <option value="">Select service…</option>
          {(options?.serviceCatalogItems ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.category ? ` · ${item.category}` : ""}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="create-job-notes">
          Notes
        </label>
        <textarea
          id="create-job-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          disabled={isBusy}
          className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-50"
          placeholder="Optional notes…"
        />

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={isBusy}
          className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isBusy ? "Submitting…" : "Complete job"}
        </button>

        {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
      </div>
    </div>
  );
}
