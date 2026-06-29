"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { WorkerCameraScan } from "@/components/worker/WorkerCameraScan";
import { fieldCompanyNotConfiguredMessage } from "@/lib/field-company-resolver-client";
import { createIdempotencyKey } from "@/lib/idempotency";
import {
  assignmentFullyCompleted,
  classifyScanResponse,
  formatLastScannedVin,
  formatScanStatusPresentation,
  isBrowserOffline,
  parseScannerVinInput,
  scanStatusClassName,
  shouldAutoSubmitScannerVin,
  shouldDebounceScan,
  validateWorkerVin,
  VIN_LENGTH,
  WORKER_SCANNER_HELPER_COPY,
  type WorkerScanStatus
} from "@/lib/worker-scanner-utils";
import {
  canCompleteServiceLine,
  formatAssignmentSummary,
  formatServiceLineCompletionDate,
  formatServiceLineCompletionLabel,
  formatVehicleTitle,
  normalizeVinInput,
  serviceCompletionBlockedMessage,
  serviceCompletionSuccessMessage,
  workerDisclaimer,
  workerEmptyAssignmentsMessage,
  type WorkerAssignmentRecord
} from "@/lib/worker-utils";

type WorkerSession = {
  employeeName?: string;
  companyName?: string;
  assignments?: WorkerAssignmentRecord[];
  message?: string;
};

type WorkerAssignmentsPanelVariant = "full" | "login" | "jobs" | "summary";

type WorkerAssignmentsPanelProps = {
  readonly pinLoginReady?: boolean;
  readonly variant?: WorkerAssignmentsPanelVariant;
  readonly initialAssignmentId?: string | null;
};

export function WorkerAssignmentsPanel({
  pinLoginReady = false,
  variant = "full",
  initialAssignmentId = null
}: WorkerAssignmentsPanelProps) {
  const router = useRouter();

  const [pin, setPin] = useState("");
  const [session, setSession] = useState<WorkerSession | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [enteredVin, setEnteredVin] = useState("");
  const [lastScannedVin, setLastScannedVin] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<WorkerScanStatus>("ready");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [completingLineId, setCompletingLineId] = useState<string | null>(null);

  const vinInputRef = useRef<HTMLInputElement | null>(null);
  const lastScanAttemptRef = useRef<{ vin: string; at: number } | null>(null);

  const assignments = useMemo(() => session?.assignments ?? [], [session?.assignments]);
  const selectedAssignment =
    assignments.find((assignment) => assignment.assignmentId === selectedAssignmentId) ?? null;
  const emptyCopy = workerEmptyAssignmentsMessage();
  const scanPresentation = formatScanStatusPresentation(scanStatus);
  const canSignIn = pinLoginReady;
  const showLoginOnly = variant === "login" && !session;
  const showJobsFlow = variant === "jobs" || variant === "full" || variant === "summary";
  const showSummaryOnly = variant === "summary" && session;
  const showVinAndComplete = showJobsFlow && !showSummaryOnly;

  const focusVinInput = useCallback(() => {
    window.setTimeout(() => vinInputRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (session && selectedAssignment) {
      focusVinInput();
    }
  }, [session, selectedAssignment, focusVinInput]);

  async function handleLookup() {
    setErrorMessage(null);
    setStatusMessage(null);
    setScanStatus("ready");

    if (!pinLoginReady) {
      setErrorMessage(fieldCompanyNotConfiguredMessage());
      return;
    }

    if (!/^\d{6}$/u.test(pin)) {
      setErrorMessage("Enter a 6-digit PIN.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to load assignments.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch("/api/worker/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin })
      });

      const payload = (await response.json().catch(() => ({}))) as WorkerSession;
      setIsBusy(false);

      if (!response.ok) {
        setSession(null);
        setSelectedAssignmentId(null);
        setErrorMessage(payload.message ?? "Unable to load assignments.");
        return;
      }

      const nextAssignments = payload.assignments ?? [];
      const preferredAssignmentId =
        initialAssignmentId &&
        nextAssignments.some((assignment) => assignment.assignmentId === initialAssignmentId)
          ? initialAssignmentId
          : (nextAssignments[0]?.assignmentId ?? null);

      setSession({
        employeeName: payload.employeeName,
        companyName: payload.companyName,
        assignments: nextAssignments
      });
      setSelectedAssignmentId(preferredAssignmentId);
      setEnteredVin("");
      setLastScannedVin(null);
      setScanStatus("ready");

      if (variant === "login") {
        router.push("/field/home");
        return;
      }
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error while loading assignments.");
    }
  }

  const handleConfirm = useCallback(
    async (rawVin?: string) => {
      if (!selectedAssignment) {
        setErrorMessage("Select an assignment first.");
        return;
      }

      if (!/^\d{6}$/u.test(pin)) {
        setErrorMessage("Enter a 6-digit PIN.");
        return;
      }

      if (isBrowserOffline()) {
        setScanStatus("network_error");
        setErrorMessage("You are offline. The scan was not submitted.");
        return;
      }

      const normalizedVin = normalizeVinInput(rawVin ?? enteredVin);
      const validationError = validateWorkerVin(normalizedVin);
      if (validationError) {
        setErrorMessage(validationError);
        setScanStatus("ready");
        focusVinInput();
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

      if (assignmentFullyCompleted(selectedAssignment.serviceLines)) {
        setScanStatus("already_completed");
        setStatusMessage("All services for this assignment are already complete.");
        focusVinInput();
        return;
      }

      setIsBusy(true);
      setErrorMessage(null);
      setStatusMessage(null);
      setScanStatus("submitting");

      try {
        const response = await fetch("/api/worker/scan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pin,
            workOrderId: selectedAssignment.workOrderId,
            workOrderAssignmentId: selectedAssignment.assignmentId,
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
          setErrorMessage(payload.message ?? "Unable to confirm vehicle responsibility.");
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
        setStatusMessage(payload.message ?? "Vehicle responsibility confirmed.");
        setEnteredVin("");
        await handleLookup();
        focusVinInput();
      } catch {
        setIsBusy(false);
        setScanStatus("network_error");
        setErrorMessage("Network error. Your scan was not submitted.");
        focusVinInput();
      }
    },
    [enteredVin, focusVinInput, pin, selectedAssignment]
  );

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
        void handleConfirm(enteredVin);
      }
    }
  }

  function handleScanAnotherVin() {
    setEnteredVin("");
    setErrorMessage(null);
    setStatusMessage(null);
    setScanStatus("ready");
    focusVinInput();
  }

  function handleSignOut() {
    setSession(null);
    setSelectedAssignmentId(null);
    setEnteredVin("");
    setLastScannedVin(null);
    setScanStatus("ready");
    setStatusMessage(null);
    setErrorMessage(null);
    setPin("");
    lastScanAttemptRef.current = null;
  }

  async function handleCompleteServiceLine(serviceLineId: string) {
    if (!selectedAssignment) {
      setErrorMessage("Select an assignment first.");
      return;
    }

    if (!canCompleteServiceLine(selectedAssignment)) {
      setErrorMessage(serviceCompletionBlockedMessage());
      return;
    }

    if (!/^\d{6}$/u.test(pin)) {
      setErrorMessage("Enter a 6-digit PIN.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Service completion was not submitted.");
      return;
    }

    setCompletingLineId(serviceLineId);
    setErrorMessage(null);
    setStatusMessage(null);
    setIsBusy(true);

    try {
      const response = await fetch(`/api/worker/service-lines/${serviceLineId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pin
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      setIsBusy(false);
      setCompletingLineId(null);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to complete service.");
        return;
      }

      setStatusMessage(payload.message ?? serviceCompletionSuccessMessage());
      await handleLookup();
      focusVinInput();
    } catch {
      setIsBusy(false);
      setCompletingLineId(null);
      setErrorMessage("Network error. Service completion was not submitted.");
    }
  }

  return (
    <div className="space-y-5">
      {!session ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
          <h2 className="text-xl font-semibold text-slate-900">
            {variant === "login" ? "Sign in" : "Login"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {variant === "login"
              ? "Enter your 6-digit PIN to sign in."
              : workerDisclaimer()}
          </p>

          {!pinLoginReady ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              {fieldCompanyNotConfiguredMessage()}
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Your workplace is configured on this device.
            </p>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="worker-pin">
                Enter your PIN
              </label>
              <input
                id="worker-pin"
                inputMode="numeric"
                pattern="\d*"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base tracking-[0.35em] disabled:bg-slate-50 disabled:text-slate-400"
                disabled={isBusy || !canSignIn}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={() => void handleLookup()}
              disabled={isBusy || !canSignIn || pin.length !== 6}
              className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isBusy ? "Loading…" : variant === "login" ? "Sign in" : "Load assignments"}
            </button>
          </div>

          {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
        </div>
      ) : showLoginOnly ? null : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-slate-900">{session.employeeName}</p>
                <p className="text-sm text-slate-500">{session.companyName}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>

            {selectedAssignment ? (
              <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5">
                <p className="text-sm font-semibold text-brand-900">
                  {formatAssignmentSummary(selectedAssignment)}
                </p>
                <p className="mt-1 text-xs text-brand-800">
                  {selectedAssignment.location.name} · VIN {selectedAssignment.vehicle.vin}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
            <h2 className="text-xl font-semibold text-slate-900">
              {showSummaryOnly ? "Summary" : "My jobs"}
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
                      onClick={() => {
                        setSelectedAssignmentId(assignment.assignmentId);
                        setScanStatus("ready");
                        setErrorMessage(null);
                        focusVinInput();
                      }}
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
                        {assignment.location.name} · {assignment.serviceLines.length} service
                        {assignment.serviceLines.length === 1 ? "" : "s"}
                      </p>
                      {assignment.lastConfirmation ? (
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          Confirmed {assignment.lastConfirmation.enteredVin}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedAssignment && showVinAndComplete ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
              <h2 className="text-xl font-semibold text-slate-900">VIN</h2>
              <p className="mt-1 text-sm text-slate-600">
                Confirm the vehicle for {formatVehicleTitle(selectedAssignment.vehicle)}.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Customer: {selectedAssignment.location.name}
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

              <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="worker-vin">
                Vehicle VIN
              </label>
              <input
                ref={vinInputRef}
                id="worker-vin"
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
                  onClick={() => void handleConfirm()}
                  disabled={isBusy}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {scanStatus === "submitting" ? "Confirming…" : "Confirm VIN"}
                </button>

                <button
                  type="button"
                  onClick={handleScanAnotherVin}
                  disabled={isBusy}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  Scan another VIN
                </button>
              </div>

              <div className="mt-4">
                <WorkerCameraScan
                  disabled={isBusy}
                  onDetected={(value) => {
                    handleVinChange(value);
                    void handleConfirm(value);
                  }}
                />
              </div>

              {statusMessage ? <p className="mt-3 text-sm text-emerald-700">{statusMessage}</p> : null}
              {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
            </div>
          ) : null}

          {selectedAssignment && (showVinAndComplete || showSummaryOnly) ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
              <h2 className="text-xl font-semibold text-slate-900">Service</h2>
              <p className="mt-1 text-sm text-slate-600">
                Mark each assigned service complete after confirming the VIN.
              </p>

              {!canCompleteServiceLine(selectedAssignment) ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                  {serviceCompletionBlockedMessage()}
                </p>
              ) : null}

              <ul className="mt-4 space-y-3">
                {selectedAssignment.serviceLines.map((line) => {
                  const isCompleted = Boolean(line.completion);
                  const isCompleting = completingLineId === line.id;

                  return (
                    <li key={line.id} className="rounded-xl border border-slate-200 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{line.serviceNameSnapshot}</p>
                          {line.serviceCategorySnapshot ? (
                            <p className="mt-1 text-xs text-slate-500">{line.serviceCategorySnapshot}</p>
                          ) : null}
                        </div>
                        <span
                          className={`inline-flex shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            isCompleted
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {formatServiceLineCompletionLabel(line.completion)}
                        </span>
                      </div>

                      {isCompleted ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Completed {formatServiceLineCompletionDate(line.completion?.completedAt)}
                        </p>
                      ) : showSummaryOnly ? (
                        <p className="mt-2 text-xs text-slate-500">Complete services from Start job.</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCompleteServiceLine(line.id)}
                          disabled={isBusy || !canCompleteServiceLine(selectedAssignment)}
                          className="mt-3 w-full rounded-xl border border-brand-600 bg-brand-50 px-4 py-3 text-base font-semibold text-brand-800 hover:bg-brand-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {isCompleting ? "Completing…" : "Mark service complete"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
