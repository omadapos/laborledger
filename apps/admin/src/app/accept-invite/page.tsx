"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";

import { DesignV2Badge } from "../../components/admin-shell";
import { validateNewPassword } from "../../lib/user-invite-utils";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFieldError(null);

    const validationError = validateNewPassword(password);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    if (!token) {
      setErrorMessage("Invitation link is missing or invalid.");
      return;
    }

    setIsSubmitting(true);

    const response = await fetch("/api/auth/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        password,
        ...(name.trim() ? { name: name.trim() } : {})
      })
    });

    const payload = (await response.json().catch(() => ({}))) as { message?: string };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to accept invitation.");
      setIsSubmitting(false);
      return;
    }

    setSuccess(true);
    setIsSubmitting(false);
    router.prefetch("/login");
  }

  if (!token) {
    return (
      <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
        This invitation link is missing a token. Ask your administrator to send a new invite.
      </p>
    );
  }

  if (success) {
    return (
      <div className="mt-8 space-y-4">
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
          Your account is ready. Sign in with the email address from your invitation.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="name">
          Full name (optional)
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          autoComplete="name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-slate-500">At least 8 characters with one letter and one number.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
          Confirm password
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          autoComplete="new-password"
        />
      </div>

      {fieldError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          {fieldError}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isSubmitting ? "Creating account…" : "Accept invitation"}
      </button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-14">
      <div className="mx-auto w-full max-w-sm">
        <DesignV2Badge />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Accept invitation</h1>
        <p className="mt-2 text-sm text-slate-500">
          Set a password to activate your LaborLedger admin access.
        </p>

        <Suspense fallback={<p className="mt-8 text-sm text-slate-500">Loading invitation…</p>}>
          <AcceptInviteForm />
        </Suspense>

        <p className="mt-6 text-sm text-slate-500">
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
