import { StatusCard } from "@/components/shared/StatusCard";

export function EmployeeHelpCard() {
  return (
    <StatusCard
      title="How LaborLedger Field works"
      description="Sign in with your PIN, clock in for your shift, then scan or enter a vehicle VIN to confirm your assignment. Select the service to complete, add optional notes, and mark the job complete. Clock out when your shift ends. Offline actions are blocked — nothing is faked as successful."
      tone="neutral"
    />
  );
}
