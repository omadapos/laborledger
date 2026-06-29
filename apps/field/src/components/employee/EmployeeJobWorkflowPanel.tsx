"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { WorkerCameraScan } from "@/components/worker/WorkerCameraScan";
import {
  assignmentRequiresLocationStep,
  fieldJobCreationRequiredMessage,
  fieldJobEmptyAssignmentsMessage,
  findAssignmentById,
  findAssignmentByVin,
  pendingServiceLines,
  type FieldJobWorkflowStep
} from "@/lib/field-job-utils";
import { fieldCompanyNotConfiguredMessage } from "@/lib/field-company-resolver-client";
import { createIdempotencyKey } from "@/lib/idempotency";
import { isBrowserOffline } from "@/lib/offline";
import {
  classifyScanResponse,
  formatLastScannedVin,
  formatScanStatusPresentation,
  parseScannerVinInput,
  scanStatusClassName,
  shouldAutoSubmitScannerVin,
  shouldDebounceScan,
  validateWorkerVin,
  VIN_LENGTH,
  WORKER_SCANNER_HELPER_COPY,
  type WorkerScanStatus
} from "@/lib/worker-scanner-utils";
import type { FieldJobsContextResponse } from "@/lib/field-jobs-client";
import {
  canCompleteServiceLine,
  formatAssignmentSummary,
  formatServiceLineCompletionDate,
  formatServiceLineCompletionLabel,
  formatVehicleTitle,
  normalizeVinInput,
  serviceCompletionBlockedMessage,
  serviceCompletionSuccessMessage,
  type WorkerAssignmentRecord
} from "@/lib/worker-utils";

type EmployeeJobWorkflowPanelProps = {
  readonly initialAssignmentId?: string | null;
  readonly summaryOnly?: boolean;
};

const STEP_LABELS: Record<FieldJobWorkflowStep, string> = {
  assignments: "Jobs",
  vin: "VIN",
  customer: "Customer",
  location: "Location",
  service: "Service",
  notes: "Notes",
  done: "Complete"
};

export function EmployeeJobWorkflowPanel({
  initialAssignmentId = null,
  summaryOnly = false
}: EmployeeJobWorkflowPanelProps) {
  const router = useRouter();

  const [context, setContext] = useState<FieldJobsContextResponse | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [step, setStep] = useState<FieldJobWorkflowStep>(summaryOnly ? "assignments" : "vin");
  const [enteredVin, setEnteredVin] = useState("");
  const [lastScannedVin, setLastScannedVin] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<WorkerScanStatus>("ready");
  const [selectedServiceLineId, setSelectedServiceLineId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const vinInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanAttemptRef = useRef<{ vin: string; at: number } | null>(null);

  const assignments = useMemo(() => context?.assignments ?? [], [context?.assignments]);
  const selectedAssignment = useMemo(
    () => findAssignmentById(assignments, selectedAssignmentId ?? ""),
    [assignments, selectedAssignmentId]
  );
  const selectedServiceLine =
    selectedAssignment?.serviceLines.find((line) => line.id === selectedServiceLineId) ?? null;
  const scanPresentation = formatScanStatusPresentation(scanStatus);
  const emptyCopy = fieldJobEmptyAssignmentsMessage();

  const focusVinInput = useCallback(() => {
    window.setTimeout(() => vinInputRef.current?.focus(), 0);
  }, []);

  const loadContext = useCallback(async () => {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to load jobs.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/field/jobs/context", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as FieldJobsContextResponse & {
        message?: string;
      };

      if (response.status === 401) {
        router.replace("/field/login");
        return;
      }

      if (response.status === 503) {
        setConfigError(payload.message ?? fieldCompanyNotConfiguredMessage());
        setContext(null);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to load jobs.");
        setIsLoading(false);
        return;
      }

      setContext(payload);
      setConfigError(null);

      const preferredAssignmentId =
        initialAssignmentId &&
        payload.assignments.some((assignment) => assignment.assignmentId === initialAssignmentId)
          ? initialAssignmentId
          : (payload.assignments[0]?.assignmentId ?? null);

      if (preferredAssignmentId) {
        setSelectedAssignmentId(preferredAssignmentId);
        if (!summaryOnly && initialAssignmentId) {
          setStep("vin");
        }
      }

      setIsLoading(false);
    } catch {
      setErrorMessage("Network error while loading jobs.");
      setIsLoading(false);
    }
  }, [initialAssignmentId, router, summaryOnly]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (step === "vin" && selectedAssignment) {
      focusVinInput();
    }
  }, [step, selectedAssignment, focusVinInput]);

  function selectAssignment(assignment: WorkerAssignmentRecord) {
    setSelectedAssignmentId(assignment.assignmentId);
    setEnteredVin("");
    setLastScannedVin(null);
    setScanStatus("ready");
    setSelectedServiceLineId(null);
    setNotes("");
    setErrorMessage(null);
    setStatusMessage(null);
    setStep(summaryOnly ? "assignments" : "vin");
    focusVinInput();
  }

  function handleVinChange(value: string) {
    setEnteredVin(parseScannerVinInput(value).slice(0, VIN_LENGTH));
    if (scanStatus !== "submitting") {
      setScanStatus("ready");
    }
  }

  function handleVinKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "Tab") {
      if (shouldAutoSubmitScannerVin(enteredVin, event.key === "Enter" ? "Enter" : "Tab")) {
        event.preventDefault();
        void handleConfirmVin(enteredVin);
      }
    }
  }

  async function handleConfirmVin(rawVin?: string) {
    const normalizedVin = normalizeVinInput(rawVin ?? enteredVin);
    const validationError = validateWorkerVin(normalizedVin);
    if (validationError) {
      setErrorMessage(validationError);
      setScanStatus("ready");
      focusVinInput();
      return;
    }

    let assignment = selectedAssignment;
    if (!assignment || assignment.vehicle.vin !== normalizedVin) {
      assignment = findAssignmentByVin(assignments, normalizedVin);
    }

    if (!assignment) {
      setIsBusy(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/field/jobs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ enteredVin: normalizedVin })
        });
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        setIsBusy(false);
        setErrorMessage(payload.message ?? fieldJobCreationRequiredMessage());
        focusVinInput();
        return;
      } catch {
        setIsBusy(false);
        setErrorMessage("Network error while checking job assignment.");
        return;
      }
    }

    setSelectedAssignmentId(assignment.assignmentId);

    if (isBrowserOffline()) {
      setScanStatus("network_error");
      setErrorMessage("You are offline. The VIN was not submitted.");
      return;
    }

    const now = Date.now();
    if (
      shouldDebounceScan(
        lastScanAttemptRef.current?.vin ?? null,
        lastScanAttemptRef.current?.at ?? null,
        normalizedVin,
        now
      )
    ) {
      setStatusMessage("Duplicate scan ignored.");
      focusVinInput();
      return;
    }

    lastScanAttemptRef.current = { vin: normalizedVin, at: now };

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setScanStatus("submitting");

    try {
      const response = await fetch("/api/field/jobs/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workOrderId: assignment.workOrderId,
          workOrderAssignmentId: assignment.assignmentId,
          enteredVin: normalizedVin,
          idempotencyKey: createIdempotencyKey()
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        accepted?: boolean;
      };

      setIsBusy(false);
      setLastScannedVin(normalizedVin);

      if (!response.ok) {
        const nextStatus = classifyScanResponse({
          ok: false,
          status: response.status,
          message: payload.message
        });
        setScanStatus(nextStatus);
        setErrorMessage(payload.message ?? "Unable to confirm VIN.");
        focusVinInput();
        return;
      }

      const nextStatus = classifyScanResponse({
        ok: true,
        status: response.status,
        message: payload.message,
        accepted: payload.accepted
      });
      setScanStatus(nextStatus);
      setStatusMessage(payload.message ?? "VIN confirmed.");
      setEnteredVin("");
      await loadContext();
      setStep("customer");
    } catch {
      setIsBusy(false);
      setScanStatus("network_error");
      setErrorMessage("Network error. Your scan was not submitted.");
      focusVinInput();
    }
  }

  async function handleCompleteService() {
    if (!selectedAssignment || !selectedServiceLineId) {
      setErrorMessage("Select a service first.");
      return;
    }

    if (!canCompleteServiceLine(selectedAssignment)) {
      setErrorMessage(serviceCompletionBlockedMessage());
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Service completion was not submitted.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/field/jobs/${selectedAssignment.assignmentId}/complete`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            serviceLineId: selectedServiceLineId,
            notes: notes.trim() || undefined
          })
        }
      );

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to complete service.");
        return;
      }

      setStatusMessage(payload.message ?? serviceCompletionSuccessMessage());
      await loadContext();
      setStep("done");
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error. Service completion was not submitted.");
    }
  }

  function handleStartAnotherJob() {
    setSelectedAssignmentId(null);
    setSelectedServiceLineId(null);
    setEnteredVin("");
    setLastScannedVin(null);
    setNotes("");
    setScanStatus("ready");
    setStatusMessage(null);
    setErrorMessage(null);
    setStep("vin");
    focusVinInput();
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        Loading jobs…
      </div>
    );
  }

  if (configError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-sm">
        {configError}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {context ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-base font-semibold text-slate-900">{context.session.employeeName}</p>
          <p className="text-sm text-slate-500">{context.session.companyName}</p>
        </div>
      ) : null}

      {!summaryOnly ? (
        <div className="flex flex-wrap gap-2">
          {(["vin", "customer", "location", "service", "notes", "done"] as const).map((stepKey) => {
            const isActive = step === stepKey;
            const isPast =
              ["vin", "customer", "location", "service", "notes", "done"].indexOf(step) >
              ["vin", "customer", "location", "service", "notes", "done"].indexOf(stepKey);
            return (
              <span
                key={stepKey}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-brand-600 text-white"
                    : isPast
                      ? "bg-brand-50 text-brand-800"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {STEP_LABELS[stepKey]}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
        <h2 className="text-xl font-semibold text-slate-900">
          {summaryOnly ? "Summary" : "Assigned jobs"}
        </h2>

        {assignments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-800">{emptyCopy.title}</p>
            <p className="mt-1 text-sm text-slate-500">{emptyCopy.description}</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {assignments.map((assignment) => {
              const isSelected = assignment.assignmentId === selectedAssignmentId;
              return (
                <button
                  key={assignment.assignmentId}
                  type="button"
                  onClick={() => selectAssignment(assignment)}
                  className={`w-full rounded-xl border px-4 py-3.5 text-left transition ${
                    isSelected
                      ? "border-brand-600 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {formatAssignmentSummary(assignment)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    VIN {assignment.vehicle.vin}
                    {assignment.vehicle.plate ? ` · Plate ${assignment.vehicle.plate}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Customer site: {assignment.location.name} · {assignment.serviceLines.length}{" "}
                    service
                    {assignment.serviceLines.length === 1 ? "" : "s"}
                  </p>
                  {assignment.lastConfirmation ? (
                    <p className="mt-2 text-xs font-medium text-emerald-700">
                      VIN confirmed {assignment.lastConfirmation.enteredVin}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!summaryOnly && step === "vin" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">VIN</h2>
          <p className="mt-1 text-sm text-slate-600">
            Scan or enter the vehicle VIN for your job.
          </p>
          <p className="mt-2 text-sm text-slate-500">{WORKER_SCANNER_HELPER_COPY}</p>

          <div
            className={`mt-4 rounded-xl border px-3 py-2.5 text-sm ${scanStatusClassName(scanPresentation.tone)}`}
            role="status"
          >
            <p className="font-semibold">{scanPresentation.label}</p>
            <p className="mt-0.5">{scanPresentation.description}</p>
            <p className="mt-2 text-xs opacity-80">{formatLastScannedVin(lastScannedVin)}</p>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="field-job-vin">
            Vehicle VIN
          </label>
          <input
            ref={vinInputRef}
            id="field-job-vin"
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
            inputMode="text"
            enterKeyHint="done"
          />

          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => void handleConfirmVin()}
              disabled={isBusy}
              className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {scanStatus === "submitting" ? "Confirming…" : "Confirm VIN"}
            </button>
          </div>

          <div className="mt-4">
            <WorkerCameraScan
              disabled={isBusy}
              onDetected={(value) => {
                handleVinChange(value);
                void handleConfirmVin(value);
              }}
            />
          </div>
        </div>
      ) : null}

      {!summaryOnly && step === "customer" && selectedAssignment ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">Customer</h2>
          <p className="mt-1 text-sm text-slate-600">
            Customer details come from your assigned job.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900">
              {formatAssignmentSummary(selectedAssignment)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {formatVehicleTitle(selectedAssignment.vehicle)}
            </p>
            <p className="mt-1 text-xs text-slate-500">VIN {selectedAssignment.vehicle.vin}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setStep(
                assignmentRequiresLocationStep(selectedAssignment) ? "location" : "service"
              )
            }
            className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800"
          >
            Continue
          </button>
        </div>
      ) : null}

      {!summaryOnly && step === "location" && selectedAssignment ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">Location</h2>
          <p className="mt-1 text-sm text-slate-600">Service location for this job.</p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900">{selectedAssignment.location.name}</p>
          </div>
          <button
            type="button"
            onClick={() => setStep("service")}
            className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800"
          >
            Continue
          </button>
        </div>
      ) : null}

      {!summaryOnly && step === "service" && selectedAssignment ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">Service</h2>
          <p className="mt-1 text-sm text-slate-600">Select the service to complete.</p>

          {!canCompleteServiceLine(selectedAssignment) ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {serviceCompletionBlockedMessage()}
            </p>
          ) : null}

          <ul className="mt-4 space-y-3">
            {selectedAssignment.serviceLines.map((line) => {
              const isCompleted = Boolean(line.completion);
              const isSelected = selectedServiceLineId === line.id;

              return (
                <li key={line.id}>
                  <button
                    type="button"
                    disabled={isCompleted}
                    onClick={() => {
                      setSelectedServiceLineId(line.id);
                      setStep("notes");
                    }}
                    className={`w-full rounded-xl border px-4 py-3.5 text-left ${
                      isCompleted
                        ? "border-slate-200 bg-slate-50 opacity-70"
                        : isSelected
                          ? "border-brand-600 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{line.serviceNameSnapshot}</p>
                        {line.serviceCategorySnapshot ? (
                          <p className="mt-1 text-xs text-slate-500">{line.serviceCategorySnapshot}</p>
                        ) : null}
                      </div>
                      <span className="inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium">
                        {formatServiceLineCompletionLabel(line.completion)}
                      </span>
                    </div>
                    {isCompleted ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Completed {formatServiceLineCompletionDate(line.completion?.completedAt)}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {pendingServiceLines(selectedAssignment).length === 0 ? (
            <button
              type="button"
              onClick={() => setStep("done")}
              className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800"
            >
              View completion
            </button>
          ) : null}
        </div>
      ) : null}

      {!summaryOnly && step === "notes" && selectedAssignment && selectedServiceLine ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">Notes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Optional notes for {selectedServiceLine.serviceNameSnapshot}.
          </p>

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="field-job-notes">
            Notes
          </label>
          <textarea
            id="field-job-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            disabled={isBusy}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-50"
            placeholder="Optional notes for this service…"
          />

          <button
            type="button"
            onClick={() => void handleCompleteService()}
            disabled={isBusy || !canCompleteServiceLine(selectedAssignment)}
            className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isBusy ? "Completing…" : "Complete"}
          </button>
        </div>
      ) : null}

      {!summaryOnly && step === "done" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-emerald-900">Complete</h2>
          <p className="mt-2 text-sm text-emerald-800">
            {statusMessage ?? "Service marked complete."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              href="/field/home"
              className="inline-flex justify-center rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold text-emerald-900"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleStartAnotherJob}
              className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Start another job
            </button>
          </div>
        </div>
      ) : null}

      {summaryOnly && (context?.recentCompletions?.length ?? 0) > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">Recent completions</h2>
          <ul className="mt-4 space-y-3">
            {context!.recentCompletions.map((completion) => (
              <li key={completion.serviceCompletionId} className="rounded-xl border border-slate-200 px-4 py-3.5">
                <p className="text-sm font-semibold text-slate-900">{completion.serviceName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {completion.customerName} · VIN {completion.vehicleVin}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatServiceLineCompletionDate(completion.completedAt)}
                  {completion.notes ? ` · ${completion.notes}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {summaryOnly && selectedAssignment ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">Services</h2>
          <ul className="mt-4 space-y-3">
            {selectedAssignment.serviceLines.map((line) => (
              <li key={line.id} className="rounded-xl border border-slate-200 px-4 py-3.5">
                <p className="text-sm font-semibold text-slate-900">{line.serviceNameSnapshot}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatServiceLineCompletionLabel(line.completion)}
                  {line.completion
                    ? ` · ${formatServiceLineCompletionDate(line.completion.completedAt)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
          <Link
            href={`/field/jobs/${selectedAssignment.assignmentId}`}
            className="mt-4 inline-flex text-sm font-medium text-brand-700 underline"
          >
            Open job
          </Link>
        </div>
      ) : null}

      {statusMessage && step !== "done" ? (
        <p className="text-sm text-emerald-700">{statusMessage}</p>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
