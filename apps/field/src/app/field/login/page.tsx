import { redirect } from "next/navigation";

import { FieldShell } from "@/components/shared/FieldShell";
import { FieldLoginPanel } from "@/components/employee/FieldLoginPanel";
import { readFieldSession } from "@/lib/field-session";
import { isWorkerCompanyConfigured } from "@/lib/worker-config";

export default async function FieldLoginPage() {
  const existingSession = await readFieldSession();
  if (existingSession) {
    redirect("/field/home");
  }

  const pinLoginReady = isWorkerCompanyConfigured();

  return (
    <FieldShell title="Sign in" subtitle="Enter your PIN to sign in." showHomeLink={false}>
      <FieldLoginPanel pinLoginReady={pinLoginReady} />
    </FieldShell>
  );
}
