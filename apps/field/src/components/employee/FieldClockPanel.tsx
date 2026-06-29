"use client";

import { useCallback, useEffect, useState } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import { FIELD_CLOCK_ACTIONS, type FieldClockAction } from "@/lib/field-clock-utils";
import { createIdempotencyKey } from "@/lib/idempotency";
import { isBrowserOffline } from "@/lib/offline";

type ClockStatus = {
  configured: boolean;
  shiftStatus?: string | null;
  punchState?: string | null;
  allowedActions?: string[];
  workedMinutes?: number | null;
  warnings?: string[];
  message?: string;
};

const ACTION_ENDPOINTS: Record<FieldClockAction, string> = {
  clock_in: "/api/field/clock/in",
  break_start: "/api/field/break/start",
  break_end: "/api/field/break/end",
  clock_out: "/api/field/clock/out"
};

type FieldClockPanelProps = {
  readonly compact?: boolean;
};

export function FieldClockPanel({ compact = false }: FieldClockPanelProps) {
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const loadClockStatus = useCallback(async () => {
    setErrorMessage(null);

    const response = await fetch("/api/field/clock/status", { cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as ClockStatus;

    if (!response.ok) {
      setClockStatus({
        configured: false,
        message: payload.message ?? "Unable to load shift status."
      });
      return;
    }

    setClockStatus(payload);
  }, []);

  useEffect(() => {
    void loadClockStatus();
  }, [loadClockStatus]);

  async function handleClockAction(action: FieldClockAction) {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Clock actions cannot submit until your connection returns.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(ACTION_ENDPOINTS[action], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idempotencyKey: createIdempotencyKey() })
      });

      const payload = (await response.json().catch(() => ({}))) as ClockStatus & {
        message?: string;
        duplicate?: boolean;
      };

      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Clock action was rejected.");
        return;
      }

      setClockStatus({
        configured: true,
        shiftStatus: payload.shiftStatus,
        punchState: payload.punchState,
        allowedActions: payload.allowedActions,
        workedMinutes: payload.workedMinutes,
        warnings: payload.warnings
      });
      setStatusMessage(payload.message ?? `${FIELD_CLOCK_ACTIONS[action]} accepted.`);
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error. Clock action was not submitted.");
    }
  }

  const allowedActions = clockStatus?.allowedActions ?? [];
  const configured = clockStatus?.configured !== false;

  return (
    <section
      className={
        compact
          ? "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          : "w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8"
      }
    >
      <h2 className="text-xl font-semibold text-slate-900">Clock</h2>
      <p className="mt-1 text-sm text-slate-600">Manage your shift, breaks, and clock out.</p>

      {!configured ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {clockStatus?.message ?? "Clock is not available on this device."}
        </p>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-900">
            Shift status: {clockStatus?.shiftStatus ?? "Loading…"}
          </p>
          {typeof clockStatus?.workedMinutes === "number" ? (
            <p className="mt-1">Worked minutes: {clockStatus.workedMinutes}</p>
          ) : null}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        {(Object.keys(FIELD_CLOCK_ACTIONS) as FieldClockAction[]).map((action) => {
          const enabled = configured && allowedActions.includes(action);
          const isPrimary = action === "clock_in" || action === "clock_out";

          return (
            <PrimaryActionButton
              key={action}
              label={FIELD_CLOCK_ACTIONS[action]}
              disabled={isBusy || !enabled}
              variant={isPrimary ? "kiosk" : "secondary"}
              onClick={() => void handleClockAction(action)}
            />
          );
        })}
      </div>

      {statusMessage ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}

      {clockStatus?.warnings?.length ? (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {clockStatus.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
