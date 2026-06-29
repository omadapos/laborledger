"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { fieldCompanyNotConfiguredMessage } from "@/lib/field-company-resolver-client";
import { isBrowserOffline } from "@/lib/offline";

type FieldLoginPanelProps = {
  readonly pinLoginReady: boolean;
};

export function FieldLoginPanel({ pinLoginReady }: FieldLoginPanelProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSignIn() {
    setErrorMessage(null);

    if (!pinLoginReady) {
      setErrorMessage(fieldCompanyNotConfiguredMessage());
      return;
    }

    if (!/^\d{6}$/u.test(pin)) {
      setErrorMessage("Enter a 6-digit PIN.");
      return;
    }

    if (isBrowserOffline()) {
      setErrorMessage("You are offline. Connect to sign in.");
      return;
    }

    setIsBusy(true);

    try {
      const response = await fetch("/api/field/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
        redirectTo?: string;
      };

      setIsBusy(false);

      if (!response.ok) {
        setErrorMessage(payload.message ?? "Unable to sign in.");
        return;
      }

      router.push(payload.redirectTo ?? "/field/home");
      router.refresh();
    } catch {
      setIsBusy(false);
      setErrorMessage("Network error while signing in.");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40">
      <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
      <p className="mt-1 text-sm text-slate-600">Enter your PIN to sign in.</p>

      {!pinLoginReady ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          {fieldCompanyNotConfiguredMessage()}
        </p>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Your workplace is configured on this device.</p>
      )}

      <div className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="field-login-pin">
            Enter your PIN
          </label>
          <input
            id="field-login-pin"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && pin.length === 6 && pinLoginReady && !isBusy) {
                void handleSignIn();
              }
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3.5 text-base tracking-[0.35em] disabled:bg-slate-50 disabled:text-slate-400"
            disabled={isBusy || !pinLoginReady}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleSignIn()}
          disabled={isBusy || !pinLoginReady || pin.length !== 6}
          className="w-full rounded-xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isBusy ? "Signing in…" : "Sign in"}
        </button>
      </div>

      {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
    </div>
  );
}
