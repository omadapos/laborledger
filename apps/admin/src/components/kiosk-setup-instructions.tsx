import type { KioskRecord } from "../lib/kiosk-utils";
import { formatKioskEnvBlock, KIOSK_SECRET_HELPER } from "../lib/kiosk-utils";

type KioskSetupInstructionsProps = {
  readonly kiosk: Pick<KioskRecord, "id" | "name">;
  readonly kioskSecret: string;
  readonly apiUrl: string;
  readonly title?: string;
};

export function KioskSetupInstructions({
  kiosk,
  kioskSecret,
  apiUrl,
  title = "Kiosk deployment environment"
}: KioskSetupInstructionsProps) {
  const envBlock = formatKioskEnvBlock({
    kioskId: kiosk.id,
    kioskSecret,
    apiUrl
  });

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-amber-800">
        Copy these values into <code className="font-mono">apps/kiosk/.env.local</code> or your deployment
        environment. {KIOSK_SECRET_HELPER}
      </p>
      <pre className="mt-3 overflow-x-auto rounded-md border border-amber-200/80 bg-white/80 p-3 font-mono text-xs text-slate-900">
        {envBlock}
      </pre>
      <p className="mt-2 text-xs text-amber-800">
        After rotating a secret, update the kiosk device configuration before the old secret stops working.
      </p>
    </div>
  );
}
