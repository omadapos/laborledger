import { credentialStatusLabel, type KioskRecord } from "../lib/kiosk-utils";

type KioskCredentialBadgeProps = {
  readonly status: KioskRecord["credentialStatus"];
};

export function KioskCredentialBadge({ status }: KioskCredentialBadgeProps) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
        {credentialStatusLabel(status)}
      </span>
    );
  }

  if (status === "revoked") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
        {credentialStatusLabel(status)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      {credentialStatusLabel(status)}
    </span>
  );
}
