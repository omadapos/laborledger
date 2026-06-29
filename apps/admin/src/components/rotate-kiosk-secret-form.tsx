"use client";

import { useState } from "react";

import { KioskSetupInstructions } from "./kiosk-setup-instructions";
import { KIOSK_SECRET_HELPER, type KioskRecord } from "../lib/kiosk-utils";

type RotateKioskSecretFormProps = {
  readonly kiosk: Pick<KioskRecord, "id" | "name" | "archivedAt">;
  readonly apiUrl: string;
};

export function RotateKioskSecretForm({ kiosk, apiUrl }: RotateKioskSecretFormProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);

  const isArchived = Boolean(kiosk.archivedAt);

  async function handleRotate() {
    setSubmitError(null);
    setRotatedSecret(null);
    setIsSubmitting(true);

    const response = await fetch(`/api/company-operations/kiosks/${kiosk.id}/rotate-secret`, {
      method: "POST",
      headers: { "content-type": "application/json" }
    });

    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
      kioskSecret?: string;
    };

    setIsSubmitting(false);

    if (!response.ok) {
      setSubmitError(payload.message ?? "Unable to rotate kiosk secret.");
      return;
    }

    if (payload.kioskSecret) {
      setRotatedSecret(payload.kioskSecret);
    }

    setIsConfirmOpen(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{KIOSK_SECRET_HELPER}</p>

      <button
        type="button"
        onClick={() => {
          setSubmitError(null);
          setIsConfirmOpen(true);
        }}
        disabled={isArchived}
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Rotate secret
      </button>

      {isArchived ? (
        <p className="text-xs text-slate-500">Reactivate this kiosk before rotating its secret.</p>
      ) : null}

      {rotatedSecret ? (
        <KioskSetupInstructions
          kiosk={kiosk}
          kioskSecret={rotatedSecret}
          apiUrl={apiUrl}
          title={`Rotated secret for ${kiosk.name}`}
        />
      ) : null}

      {isConfirmOpen ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" role="dialog">
          <h4 className="text-sm font-semibold text-slate-900">Rotate kiosk secret?</h4>
          <p className="mt-1 text-sm text-slate-600">
            The current secret stops working immediately. Update the kiosk deployment environment with the
            new secret shown once after confirmation.
          </p>
          {submitError ? <p className="mt-2 text-xs text-red-600">{submitError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRotate}
              disabled={isSubmitting}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Rotating…" : "Confirm rotation"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
