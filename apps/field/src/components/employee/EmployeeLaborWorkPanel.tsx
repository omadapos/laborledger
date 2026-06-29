"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import type {
  FieldLaborWorkAssignment,
  FieldLaborWorkOptionsResponse
} from "@/lib/field-labor-work-client";

type ActiveResponse = {
  clockedIn: boolean;
  assignment: FieldLaborWorkAssignment | null;
  message?: string;
};

const PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function EmployeeLaborWorkPanel() {
  const [active, setActive] = useState<ActiveResponse | null>(null);
  const [options, setOptions] = useState<FieldLaborWorkOptionsResponse | null>(null);
  const [showStartForm, setShowStartForm] = useState(false);
  const [serviceClientId, setServiceClientId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [serviceCatalogItemId, setServiceCatalogItemId] = useState("");
  const [vin, setVin] = useState("");
  const [notes, setNotes] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadActive = useCallback(async () => {
    setErrorMessage(null);
    const response = await fetch("/api/field/labor-work/active", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as ActiveResponse & {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to load current work.");
      return;
    }

    setActive(payload);
  }, []);

  const loadOptions = useCallback(async () => {
    const response = await fetch("/api/field/labor-work/available-options", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as FieldLaborWorkOptionsResponse & {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to load work options.");
      return;
    }

    setOptions(payload);
  }, []);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  const filteredLocations = useMemo(() => {
    if (!options || !serviceClientId) {
      return [];
    }
    return options.locations.filter((location) => location.serviceClientId === serviceClientId);
  }, [options, serviceClientId]);

  async function handleStartWork() {
    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const response = await fetch("/api/field/labor-work/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceClientId,
        locationId,
        serviceCatalogItemId,
        vin: vin.trim() || undefined,
        notes: notes.trim() || undefined
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    setIsBusy(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to start work.");
      return;
    }

    setShowStartForm(false);
    setStatusMessage(payload.message ?? "Work started.");
    await loadActive();
  }

  async function mutateWork(
    path: string,
    method: "POST" | "PATCH",
    body?: Record<string, unknown>,
    successMessage?: string
  ) {
    if (!active?.assignment) {
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const response = await fetch(`/api/field/labor-work/${active.assignment.id}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {})
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    setIsBusy(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Action was rejected.");
      return;
    }

    setStatusMessage(successMessage ?? "Updated.");
    await loadActive();
  }

  const assignment = active?.assignment;
  const clockedIn = active?.clockedIn === true;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">Current work</h2>
      <p className="mt-1 text-sm text-slate-600">
        Track what you are doing. Billable hours come from approved clock/punch time.
      </p>

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}

      {!clockedIn ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          Clock in first before starting work.
        </p>
      ) : assignment ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-sm font-medium text-brand-900">Work in progress</p>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="font-medium text-slate-900">Client</dt>
                <dd>{assignment.clientName}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Address</dt>
                <dd>{assignment.address}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Service</dt>
                <dd>{assignment.serviceName}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Worker</dt>
                <dd>{assignment.employeeName}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Work started</dt>
                <dd>{formatTime(assignment.startedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Status</dt>
                <dd>{assignment.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Progress</dt>
                <dd>{assignment.progressPercent}%</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-slate-600">
              Reference service time only. Billable labor hours come from approved clock/punch time.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {PROGRESS_OPTIONS.map((percent) => (
              <button
                key={percent}
                type="button"
                disabled={isBusy}
                onClick={() =>
                  void mutateWork("/progress", "PATCH", { progressPercent: percent }, "Progress updated.")
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Update progress to {percent}%
              </button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <PrimaryActionButton
              disabled={isBusy}
              label="Mark prep"
              onClick={() => void mutateWork("/progress", "PATCH", { referenceAction: "prep_start" })}
            />
            <PrimaryActionButton
              disabled={isBusy}
              label="Mark wash"
              onClick={() => void mutateWork("/progress", "PATCH", { referenceAction: "wash_start" })}
            />
            <PrimaryActionButton
              disabled={isBusy}
              label="Finish work"
              onClick={() => void mutateWork("/complete", "POST", undefined, "Work finished.")}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void mutateWork("/cancel", "POST", undefined, "Work cancelled.")}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel work
            </button>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="blocked-reason">
              Report blocker
            </label>
            <textarea
              id="blocked-reason"
              value={blockedReason}
              onChange={(event) => setBlockedReason(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="What is blocking this work?"
            />
            <PrimaryActionButton
              disabled={isBusy || !blockedReason.trim()}
              label="Report block"
              onClick={() =>
                void mutateWork(
                  "/block",
                  "POST",
                  { blockedReason: blockedReason.trim() },
                  "Block reported."
                ).then(() => setBlockedReason(""))
              }
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            No active work assignment.
          </p>

          {!showStartForm ? (
            <PrimaryActionButton
              disabled={isBusy}
              label="Start work"
              onClick={() => {
                setShowStartForm(true);
                void loadOptions();
              }}
            />
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="service-client">
                  Client
                </label>
                <select
                  id="service-client"
                  value={serviceClientId}
                  onChange={(event) => {
                    setServiceClientId(event.target.value);
                    setLocationId("");
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select client</option>
                  {options?.serviceClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="location">
                  Work address
                </label>
                <select
                  id="location"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select address</option>
                  {filteredLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="service">
                  Service
                </label>
                <select
                  id="service"
                  value={serviceCatalogItemId}
                  onChange={(event) => setServiceCatalogItemId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Select service</option>
                  {options?.serviceCatalogItems.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="vin">
                  VIN (optional)
                </label>
                <input
                  id="vin"
                  value={vin}
                  onChange={(event) => setVin(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="notes">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <PrimaryActionButton
                  disabled={
                    isBusy || !serviceClientId || !locationId || !serviceCatalogItemId
                  }
                  label="Start work"
                  onClick={() => void handleStartWork()}
                />
                <button
                  type="button"
                  onClick={() => setShowStartForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
