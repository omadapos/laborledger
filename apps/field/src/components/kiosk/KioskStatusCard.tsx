import { StatusCard } from "@/components/shared/StatusCard";

type KioskStatusCardProps = {
  readonly configured: boolean;
  readonly kioskId: string | null;
};

export function KioskStatusCard({ configured, kioskId }: KioskStatusCardProps) {
  if (configured) {
    return (
      <StatusCard
        title="Kiosk ready"
        description={
          kioskId
            ? `Location kiosk (${kioskId}) is configured. Employees can punch with a 6-digit PIN — same backend rules as apps/kiosk.`
            : "Kiosk credentials are configured. Employees can punch with a 6-digit PIN — same backend rules as apps/kiosk."
        }
        tone="success"
      />
    );
  }

  return (
    <StatusCard
      title="Kiosk credential required"
      description="Set KIOSK_ID and KIOSK_SECRET in apps/field/.env.local (same values as apps/kiosk). Run pnpm seed:demo for local credentials. PIN entry stays disabled until both are set."
      tone="warning"
    />
  );
}
