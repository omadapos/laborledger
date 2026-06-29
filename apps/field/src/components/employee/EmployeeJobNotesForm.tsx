"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PrimaryActionButton } from "@/components/shared/PrimaryActionButton";
import { isBrowserOffline } from "@/lib/offline";

type EmployeeJobNotesFormProps = {
  readonly assignmentId: string;
  readonly serviceLineId: string;
  readonly serviceName: string;
  readonly onComplete?: () => void;
};

export function EmployeeJobNotesForm({
  assignmentId,
  serviceLineId,
  serviceName,
  onComplete
}: EmployeeJobNotesFormProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const ensureSession = useCallback(async () => {
    const response = await fetch("/api/field/me", { cache: "no-store" });
    if (response.status === 401) {
      router.replace("/field/login");
    }
  }, [router]);

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  async function handleComplete() {
    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Service completion was not submitted.");
      return;
    }

    setIsBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/field/jobs/${assignmentId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceLineId,
          notes: notes.trim() || undefined
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };

      if (response.status === 401) {
        router.replace("/field/login");
        return;
      }

      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to complete service.");
        return;
      }

      setStatusMessage(payload.message ?? "Service marked complete.");
      onComplete?.();
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error. Service completion was not submitted.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Notes — {serviceName}</h2>
      <p className="mt-1 text-sm text-slate-600">Optional notes are saved when you complete this service.</p>

      <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="service-notes">
        Notes
      </label>
      <textarea
        id="service-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={4}
        disabled={isBusy}
        className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-base disabled:bg-slate-50"
        placeholder="Optional notes for this service…"
      />

      <div className="mt-4">
        <PrimaryActionButton
          label={isBusy ? "Completing…" : "Complete"}
          disabled={isBusy}
          variant="primary"
          onClick={() => void handleComplete()}
        />
      </div>

      {statusMessage ? <p className="mt-3 text-sm text-emerald-700">{statusMessage}</p> : null}
      {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
