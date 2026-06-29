"use client";

import { ArchiveKioskButton } from "./archive-kiosk-button";
import { EditKioskForm } from "./edit-kiosk-form";
import { KioskCredentialBadge } from "./kiosk-credential-badge";
import { KioskStatusBadge } from "./kiosk-status-badge";
import { RotateKioskSecretForm } from "./rotate-kiosk-secret-form";
import { formatKioskDate, KIOSK_SECRET_HELPER, type KioskRecord } from "../lib/kiosk-utils";

type KioskDetailDrawerProps = {
  readonly kiosk: KioskRecord | null;
  readonly companyName: string;
  readonly apiUrl: string;
  readonly onClose: () => void;
};

export function KioskDetailDrawer({ kiosk, companyName, apiUrl, onClose }: KioskDetailDrawerProps) {
  if (!kiosk) {
    return null;
  }

  const isArchived = Boolean(kiosk.archivedAt);

  return (
    <>
      <button
        type="button"
        aria-label="Close kiosk detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="kiosk-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="kiosk-detail-title" className="truncate text-base font-semibold text-slate-900">
              {kiosk.name}
            </h2>
            <p className="text-xs text-slate-500">{companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <KioskStatusBadge archivedAt={kiosk.archivedAt} />
            <KioskCredentialBadge status={kiosk.credentialStatus} />
            <span className="text-xs text-slate-500">Added {formatKioskDate(kiosk.createdAt)}</span>
          </div>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Device details</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Kiosk ID</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-slate-900">{kiosk.id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Location</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">{kiosk.locationName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Credential issued</dt>
                  <dd className="mt-0.5 text-slate-900">{formatKioskDate(kiosk.credentialCreatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Last updated</dt>
                  <dd className="mt-0.5 text-slate-900">{formatKioskDate(kiosk.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Pairing</h3>
            <p className="text-xs text-slate-500">{KIOSK_SECRET_HELPER}</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-700">
              <p>
                Configure the kiosk app with <code className="font-mono text-xs">KIOSK_ID</code>,{" "}
                <code className="font-mono text-xs">KIOSK_SECRET</code>, and{" "}
                <code className="font-mono text-xs">API_BASE_URL</code> in its deployment environment.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Stored secrets are never shown here. Rotate the secret to receive a new one-time value.
              </p>
            </div>
            <RotateKioskSecretForm kiosk={kiosk} apiUrl={apiUrl} />
          </section>

          <section className="mt-6 space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">Maintenance</h3>
            <EditKioskForm kioskId={kiosk.id} initialName={kiosk.name} disabled={isArchived} />
            <ArchiveKioskButton
              kioskId={kiosk.id}
              kioskName={kiosk.name}
              isArchived={isArchived}
              onStatusChange={onClose}
            />
          </section>
        </div>
      </aside>
    </>
  );
}
