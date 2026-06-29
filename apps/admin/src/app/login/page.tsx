"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { DesignV2Badge } from "../../components/admin-shell";
import { resolveLoginRedirectPath, type AuthLoginResponse } from "../../lib/auth-utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const payload = (await response.json().catch(() => ({}))) as AuthLoginResponse & {
      message?: string;
    };

    if (!response.ok) {
      setErrorMessage(payload.message ?? "Unable to sign in.");
      setIsSubmitting(false);
      return;
    }

    router.push(resolveLoginRedirectPath(payload.redirectTo));
    router.refresh();
  }

  return (
    <main className="flex min-h-screen">
      <section className="hidden w-[44%] flex-col justify-between border-r border-slate-800 bg-slate-950 px-12 py-14 text-white lg:flex">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold">
            SH
          </div>
          <h1 className="mt-10 text-3xl font-semibold tracking-tight">LaborLedger Admin</h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-400">
            Multi-company workforce operations for timekeeping, scheduling, and gross-pay preparation.
          </p>
        </div>
        <p className="text-xs text-slate-500">Secure HttpOnly session · tenant-scoped access</p>
      </section>

      <section className="flex w-full flex-col justify-center bg-white px-6 py-14 lg:w-[56%] lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex flex-wrap items-center gap-2 lg:hidden">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">LaborLedger</p>
            <DesignV2Badge />
          </div>

          <div className="hidden lg:block">
            <DesignV2Badge />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">Use your work email to load company context and employees.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="name@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700" htmlFor="password">
                  Password
                </label>
                <a
                  href="/forgot-password"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>

            {errorMessage ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{errorMessage}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
