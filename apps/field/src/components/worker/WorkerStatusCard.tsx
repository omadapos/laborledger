import { StatusCard } from "@/components/shared/StatusCard";

type WorkerStatusCardProps = {
  readonly configured: boolean;
};

export function WorkerStatusCard({ configured }: WorkerStatusCardProps) {
  if (configured) {
    return (
      <StatusCard
        title="Sign-in ready"
        description="Your workplace is configured on this device. Sign in with your 6-digit PIN."
        tone="success"
      />
    );
  }

  return (
    <StatusCard
      title="Sign-in not configured"
      description="Set WORKER_COMPANY_ID in apps/field/.env.local (from pnpm seed:demo). Sign-in stays disabled until your workplace is configured server-side."
      tone="warning"
    />
  );
}
