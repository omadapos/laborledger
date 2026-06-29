"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import {
  shiftUtcBoundsToFormParts,
  validateCancelReason,
  validateShiftForm,
  type EmployeeOption,
  type ShiftListRecord
} from "../lib/shift-utils";

type EditShiftFormProps = {
  readonly shift: ShiftListRecord;
  readonly employees: EmployeeOption[];
  readonly onClose: () => void;
};

export function EditShiftForm({ shift, employees, onClose }: EditShiftFormProps) {
  const router = useRouter();
  const initial = shiftUtcBoundsToFormParts(shift.scheduledStartUtc, shift.scheduledEndUtc, shift.timezone);
  const [employeeId, setEmployeeId] = useState(shift.employeeId);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const validation = validateShiftForm({
      employeeId,
      serviceClientId: shift.serviceClientId,
      locationId: shift.locationId,
      startDate,
      startTime,
      endDate,
      endTime,
      timeZone: shift.timezone
    });

    if (Object.keys(validation.errors).length > 0 || !validation.startUtc || !validation.endUtc) {
      setFieldErrors(validation.errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/shifts/${shift.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        employeeId,
        scheduledStartUtc: validation.startUtc,
        scheduledEndUtc: validation.endUtc
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string; conflicts?: unknown[] };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to update shift.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-slate-900">Edit shift</h3>
      <p className="mt-1 text-xs text-slate-500">
        {shift.serviceClient?.name ?? "—"} · {shift.location?.name ?? "—"} · {shift.timezone}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor={`edit-employee-${shift.id}`}>
            Employee
          </label>
          <select
            id={`edit-employee-${shift.id}`}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          >
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
          {fieldErrors.employeeId ? <p className="mt-1 text-sm text-red-600">{fieldErrors.employeeId}</p> : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
          {fieldErrors.startDate ? <p className="mt-1 text-sm text-red-600">{fieldErrors.startDate}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Start time</label>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
          {fieldErrors.startTime ? <p className="mt-1 text-sm text-red-600">{fieldErrors.startTime}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
          {fieldErrors.endDate ? <p className="mt-1 text-sm text-red-600">{fieldErrors.endDate}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">End time</label>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={isSubmitting}
          />
          {fieldErrors.endTime ? <p className="mt-1 text-sm text-red-600">{fieldErrors.endTime}</p> : null}
        </div>
      </div>

      {submitError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
          Close
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

type CancelShiftFormProps = {
  readonly shift: ShiftListRecord;
  readonly onClose: () => void;
};

export function CancelShiftForm({ shift, onClose }: CancelShiftFormProps) {
  const router = useRouter();
  const [cancelReason, setCancelReason] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const validationError = validateCancelReason(cancelReason);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/shifts/${shift.id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cancelReason: cancelReason.trim() })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to cancel shift.");
      return;
    }

    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
      <h3 className="text-sm font-semibold text-slate-900">Cancel shift</h3>
      <p className="mt-1 text-xs text-amber-800">
        Cancelled shifts cannot be used for kiosk clock-in. This action is audited and cannot be undone.
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor={`cancel-reason-${shift.id}`}>
        Reason
      </label>
      <textarea
        id={`cancel-reason-${shift.id}`}
        value={cancelReason}
        onChange={(event) => setCancelReason(event.target.value)}
        rows={3}
        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        disabled={isSubmitting}
      />

      {submitError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
          Close
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isSubmitting ? "Cancelling…" : "Cancel shift"}
        </button>
      </div>
    </form>
  );
}
