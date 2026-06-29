"use client";

import { useMemo, useState } from "react";

import { PinPad } from "@/components/shared/PinPad";
import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import { createIdempotencyKey } from "@/lib/idempotency";
import { isBrowserOffline } from "@/lib/offline";
import { validatePin } from "@/lib/pin";

type PunchSession = {
  employeeName?: string;
  punchState?: string;
  allowedActions?: string[];
  warnings?: string[];
  workedMinutes?: number | null;
  duplicate?: boolean;
  message?: string;
};

const ACTION_LABELS: Record<string, string> = {
  clock_in: "Clock In",
  break_start: "Start Break",
  break_end: "End Break",
  clock_out: "Clock Out"
};

type KioskPunchPanelProps = {
  readonly configured?: boolean;
};

/** Employee time clock — uses internal kiosk punch BFF; no punch logic in the client. */
export function KioskPunchPanel({ configured = true }: KioskPunchPanelProps) {
  const [pin, setPin] = useState("");
  const [session, setSession] = useState<PunchSession | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const allowedActions = useMemo(() => session?.allowedActions ?? [], [session?.allowedActions]);

  async function lookupSession(nextPin: string) {
    if (!configured) {
      setErrorMessage("Time clock is not configured on this device.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to load a shift.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const response = await fetch("/api/kiosk/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin: nextPin })
    });

    const payload = (await response.json().catch(() => ({}))) as PunchSession;
    setIsBusy(false);

    if (!response.ok) {
      setSession(null);
      setErrorMessage(payload.message ?? "Unable to load punch session.");
      return;
    }

    setSession(payload);
  }

  async function handlePinSubmit() {
    const pinError = validatePin(pin);
    if (pinError) {
      setErrorMessage(pinError);
      return;
    }

    await lookupSession(pin);
  }

  async function handlePunch(action: string) {
    if (!configured) {
      setErrorMessage("Time clock is not configured on this device.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Punches cannot submit until your connection returns.");
      return;
    }

    const pinError = validatePin(pin);
    if (pinError) {
      setErrorMessage(pinError);
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const response = await fetch("/api/kiosk/punch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pin,
        action,
        idempotencyKey: createIdempotencyKey()
      })
    });

    const payload = (await response.json().catch(() => ({}))) as PunchSession;
    setIsBusy(false);

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Punch was rejected.");
      return;
    }

    setSession(payload);
    setStatusMessage(
      payload.duplicate ? "Duplicate request ignored (idempotent)." : `${ACTION_LABELS[action] ?? action} accepted.`
    );
  }

  const inputsDisabled = isBusy || !configured;

  return (
    <section className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-center text-sm text-slate-600">
        {configured
          ? "Enter your PIN to load today's eligible shift."
          : "This device is not configured for time clock punches yet."}
      </p>

      <div className="mt-6">
        <PinPad value={pin} disabled={inputsDisabled} onChange={(value) => {
          setPin(value);
          setSession(null);
          setErrorMessage(null);
          setStatusMessage(null);
        }} />
      </div>

      <div className="mt-4 flex justify-center">
        <PrimaryActionButton
          label={isBusy ? "Loading…" : "Load shift"}
          disabled={inputsDisabled || pin.length !== 6}
          variant="secondary"
          onClick={() => void handlePinSubmit()}
        />
      </div>

      {session?.employeeName ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{session.employeeName}</p>
          <p className="mt-1 capitalize">State: {session.punchState?.replaceAll("_", " ") ?? "unknown"}</p>
          {typeof session.workedMinutes === "number" ? (
            <p className="mt-1">Worked minutes: {session.workedMinutes}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3">
        {(["clock_in", "break_start", "break_end", "clock_out"] as const).map((action) => {
          const enabled = allowedActions.includes(action);
          const isPrimary = action === "clock_in" || action === "clock_out";

          return (
            <PrimaryActionButton
              key={action}
              label={ACTION_LABELS[action] ?? action}
              disabled={inputsDisabled || !enabled}
              variant={isPrimary ? "kiosk" : "secondary"}
              onClick={() => void handlePunch(action)}
            />
          );
        })}
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}

      {session?.warnings?.length ? (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {session.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
      ) : null}
    </section>
  );
}
