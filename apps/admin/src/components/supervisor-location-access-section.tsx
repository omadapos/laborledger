"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  buildAssignSupervisorLocationPath,
  buildRemoveSupervisorLocationPath,
  formatAssignedLocationCount,
  formatSupervisorLabel,
  groupAssignmentsBySupervisor,
  SUPERVISOR_ACCESS_HELPER_COPY,
  SUPERVISOR_PIN_HELPER_COPY,
  SUPERVISOR_ROLE_HELPER_COPY,
  supervisorAccessEmptyMessage,
  validateSupervisorAssignmentInput,
  type CompanySupervisorRecord,
  type LocationOption,
  type SupervisorLocationAssignmentRecord
} from "../lib/supervisor-assignment-utils";

type SupervisorLocationAccessSectionProps = {
  readonly companyId: string;
  readonly supervisors: CompanySupervisorRecord[];
  readonly assignments: SupervisorLocationAssignmentRecord[];
  readonly locations: LocationOption[];
};

export function SupervisorLocationAccessSection({
  companyId,
  supervisors,
  assignments,
  locations
}: SupervisorLocationAccessSectionProps) {
  const router = useRouter();
  const [selectedSupervisorId, setSelectedSupervisorId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);

  const activeLocations = useMemo(
    () => locations.filter((location) => !location.archivedAt),
    [locations]
  );

  const assignmentsBySupervisor = useMemo(
    () => groupAssignmentsBySupervisor(assignments),
    [assignments]
  );

  const emptyState = supervisorAccessEmptyMessage(supervisors, activeLocations);

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const validationError = validateSupervisorAssignmentInput(selectedSupervisorId, selectedLocationId);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setFieldError(null);
    setIsSubmitting(true);

    const response = await fetch(buildAssignSupervisorLocationPath(companyId, selectedSupervisorId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locationId: selectedLocationId })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to assign location.");
      return;
    }

    setSuccessMessage("Supervisor location access updated.");
    setSelectedLocationId("");
    router.refresh();
  }

  async function handleRemove(supervisorUserId: string, locationId: string) {
    const key = `${supervisorUserId}:${locationId}`;
    setSubmitError(null);
    setSuccessMessage(null);
    setRemovingKey(key);

    const response = await fetch(
      buildRemoveSupervisorLocationPath(companyId, supervisorUserId, locationId),
      { method: "DELETE" }
    );

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    setRemovingKey(null);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to remove assignment.");
      return;
    }

    setSuccessMessage("Supervisor location access removed.");
    router.refresh();
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Supervisor location access</h2>
        <p className="mt-1 text-sm text-slate-500">{SUPERVISOR_ACCESS_HELPER_COPY}</p>
        <p className="mt-2 text-sm text-slate-500">{SUPERVISOR_PIN_HELPER_COPY}</p>
        <p className="mt-2 text-sm text-slate-500">{SUPERVISOR_ROLE_HELPER_COPY}</p>
      </div>

      <form
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
        onSubmit={handleAssign}
      >
        <h3 className="text-sm font-semibold text-slate-900">Assign location</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-user">
              Supervisor
            </label>
            <select
              id="supervisor-user"
              value={selectedSupervisorId}
              onChange={(event) => setSelectedSupervisorId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900"
              disabled={isSubmitting || supervisors.length === 0}
            >
              <option value="">Select supervisor</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.userId} value={supervisor.userId}>
                  {formatSupervisorLabel(supervisor)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="supervisor-location">
              Location
            </label>
            <select
              id="supervisor-location"
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900"
              disabled={isSubmitting || activeLocations.length === 0}
            >
              <option value="">Select location</option>
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting || supervisors.length === 0 || activeLocations.length === 0}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Assigning…" : "Assign location"}
            </button>
          </div>
        </div>

        {fieldError ? <p className="mt-3 text-sm text-red-600">{fieldError}</p> : null}
      </form>

      {successMessage ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}

      {submitError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
      ) : null}

      {supervisors.length === 0 || assignments.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{emptyState.title}</span>
          <span className="mt-1 block">{emptyState.description}</span>
        </p>
      ) : (
        <div className="space-y-4">
          {supervisors.map((supervisor) => {
            const supervisorAssignments = assignmentsBySupervisor.get(supervisor.userId) ?? [];

            return (
              <article
                key={supervisor.userId}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/30"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {formatSupervisorLabel(supervisor)}
                    </h3>
                    <p className="text-sm text-slate-500">{supervisor.email}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {formatAssignedLocationCount(supervisor.assignedLocationCount)}
                  </span>
                </div>

                {supervisorAssignments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No locations assigned yet.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {supervisorAssignments.map((assignment) => {
                      const removeKey = `${assignment.supervisorUserId}:${assignment.locationId}`;

                      return (
                        <li
                          key={assignment.id}
                          className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900">{assignment.location.name}</p>
                            <p className="text-xs text-slate-500">{assignment.location.timezone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemove(assignment.supervisorUserId, assignment.locationId)
                            }
                            disabled={removingKey === removeKey}
                            className="text-sm font-medium text-red-600 hover:text-red-700 disabled:text-slate-400"
                          >
                            {removingKey === removeKey ? "Removing…" : "Remove"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
