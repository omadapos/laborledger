"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  DEFAULT_TIMEZONE,
  validateShiftForm,
  type EmployeeOption,
  type LocationOption,
  type ServiceClientOption
} from "../lib/shift-utils";

type CreateShiftFormProps = {
  readonly companyId: string;
  readonly employees: EmployeeOption[];
  readonly serviceClients: ServiceClientOption[];
  readonly locations: LocationOption[];
};

export function CreateShiftForm({
  companyId,
  employees,
  serviceClients,
  locations
}: CreateShiftFormProps) {
  const router = useRouter();
  const activeEmployees = employees.filter((employee) => !employee.archivedAt);
  const activeClients = serviceClients.filter((client) => !client.archivedAt);
  const activeLocations = locations.filter((location) => !location.archivedAt);

  const [isOpen, setIsOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(activeEmployees[0]?.id ?? "");
  const [serviceClientId, setServiceClientId] = useState(activeClients[0]?.id ?? "");
  const [locationId, setLocationId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("17:00");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const locationsForClient = useMemo(
    () => activeLocations.filter((location) => location.serviceClientId === serviceClientId),
    [activeLocations, serviceClientId]
  );

  const selectedLocation =
    locationsForClient.find((location) => location.id === locationId) ?? locationsForClient[0] ?? null;

  const resolvedLocationId = selectedLocation?.id ?? "";
  const locationTimeZone = selectedLocation?.timezone ?? DEFAULT_TIMEZONE;

  function resetForm() {
    setEmployeeId(activeEmployees[0]?.id ?? "");
    setServiceClientId(activeClients[0]?.id ?? "");
    setLocationId("");
    setStartDate("");
    setStartTime("09:00");
    setEndDate("");
    setEndTime("17:00");
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

    const validation = validateShiftForm({
      employeeId,
      serviceClientId,
      locationId: resolvedLocationId,
      startDate,
      startTime,
      endDate,
      endTime,
      timeZone: locationTimeZone
    });

    if (Object.keys(validation.errors).length > 0 || !validation.startUtc || !validation.endUtc) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/companies/${companyId}/shifts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId,
        serviceClientId,
        locationId: resolvedLocationId,
        scheduledStartUtc: validation.startUtc,
        scheduledEndUtc: validation.endUtc
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to create shift.");
      return;
    }

    setSuccessMessage("Shift was scheduled successfully.");
    resetForm();
    setIsOpen(false);
    router.refresh();
  }

  if (activeEmployees.length === 0 || activeClients.length === 0 || activeLocations.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Add active employees, service clients, and locations before scheduling shifts.
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        {isOpen ? "Cancel" : "Create shift"}
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
          <h2 className="text-sm font-semibold text-slate-900">New shift</h2>
          <p className="mt-1 text-sm text-slate-500">
            Times are entered in the selected location&apos;s time zone. Overnight shifts are allowed and display under
            the scheduled start date.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-employee">
                Employee
              </label>
              <select
                id="shift-employee"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              >
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
              {fieldErrors.employeeId ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.employeeId}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-service-client">
                Service client
              </label>
              <select
                id="shift-service-client"
                value={serviceClientId}
                onChange={(event) => {
                  setServiceClientId(event.target.value);
                  setLocationId("");
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              >
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              {fieldErrors.serviceClientId ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.serviceClientId}</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-location">
                Location
              </label>
              <select
                id="shift-location"
                value={resolvedLocationId}
                onChange={(event) => setLocationId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting || locationsForClient.length === 0}
              >
                {locationsForClient.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              {locationsForClient.length === 0 ? (
                <p className="mt-1.5 text-sm text-amber-700">No active locations for this service client.</p>
              ) : null}
              {fieldErrors.locationId ? (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.locationId}</p>
              ) : null}
              {selectedLocation ? (
                <p className="mt-1.5 font-mono text-xs text-slate-500">Time zone: {selectedLocation.timezone}</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              Overnight shifts are allowed and will display under the scheduled start date.
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-start-date">
                Scheduled start date
              </label>
              <input
                id="shift-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              />
              {fieldErrors.startDate ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.startDate}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-start-time">
                Scheduled start time
              </label>
              <input
                id="shift-start-time"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              />
              {fieldErrors.startTime ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.startTime}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-end-date">
                Scheduled end date
              </label>
              <input
                id="shift-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              />
              {fieldErrors.endDate ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.endDate}</p> : null}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="shift-end-time">
                Scheduled end time
              </label>
              <input
                id="shift-end-time"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                disabled={isSubmitting}
              />
              {fieldErrors.endTime ? <p className="mt-1.5 text-sm text-red-600">{fieldErrors.endTime}</p> : null}
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
              disabled={isSubmitting || locationsForClient.length === 0}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Creating…" : "Create shift"}
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
