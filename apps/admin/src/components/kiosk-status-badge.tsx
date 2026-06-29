import { LocationStatusBadge } from "./location-status-badge";

type KioskStatusBadgeProps = {
  readonly archivedAt: string | null;
};

export function KioskStatusBadge({ archivedAt }: KioskStatusBadgeProps) {
  return <LocationStatusBadge archivedAt={archivedAt} />;
}
